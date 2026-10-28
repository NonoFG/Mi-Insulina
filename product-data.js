const BARCODE_LENGTHS = new Set([8, 12, 13, 14]);
const MASS_UNITS = new Map([["mg", 0.001], ["g", 1], ["kg", 1000]]);
const VOLUME_UNITS = new Map([["ml", 1], ["cl", 10], ["dl", 100], ["l", 1000]]);

export class ProductDataError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProductDataError";
    this.code = code;
  }
}

function productError(code, message) {
  return new ProductDataError(code, message);
}

export function normalizeBarcode(value) {
  if (typeof value !== "string") {
    throw productError("invalid_barcode", "El código de barras debe ser texto.");
  }

  const code = value.trim();
  if (!/^\d+$/.test(code) || !BARCODE_LENGTHS.has(code.length)) {
    throw productError("invalid_barcode", "El código debe ser EAN-8, UPC-A, EAN-13 o GTIN-14.");
  }

  let sum = 0;
  let weight = 3;
  for (let index = code.length - 2; index >= 0; index -= 1) {
    sum += Number(code[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  if ((10 - (sum % 10)) % 10 !== Number(code.at(-1))) {
    throw productError("invalid_barcode", "El código de barras tiene un dígito de control incorrecto.");
  }

  return code;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function knownUnit(value) {
  const unit = text(value).toLowerCase();
  if (unit === "g" || unit === "ml") return unit;
  if (MASS_UNITS.has(unit)) return "g";
  if (VOLUME_UNITS.has(unit)) return "ml";
  return null;
}

function parseMeasure(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/(?:^|[^\p{L}])([0-9]+(?:[.,][0-9]+)?)\s*(kg|mg|g|ml|cl|dl|l)(?=$|[^\p{L}])/iu);
  if (!match) return null;

  const amount = Number(match[1].replace(",", "."));
  const sourceUnit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const factor = MASS_UNITS.get(sourceUnit) ?? VOLUME_UNITS.get(sourceUnit);
  if (factor === undefined) return null;
  return {
    amount: amount * factor,
    unit: MASS_UNITS.has(sourceUnit) ? "g" : "ml",
  };
}

function parseMultipack(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^\s*([0-9]+)\s*(?:x|×)\s*([0-9]+(?:[.,][0-9]+)?)\s*(kg|mg|g|ml|cl|dl|l)(?=$|[^\p{L}])/iu);
  if (!match || Number(match[1]) < 1) return null;
  return parseMeasure(`${match[2]} ${match[3]}`);
}

function numericValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const normalized = value.trim().replace(",", ".");
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function nutrient100g(nutriments, key) {
  const value = numericValue(nutriments?.[`${key}_100g`]);
  return value !== null && value >= 0 && value <= 100 ? value : null;
}

function servingQuantity(product) {
  const amount = numericValue(product.serving_quantity);
  const sourceUnit = text(product.serving_quantity_unit).toLowerCase();
  const unit = knownUnit(sourceUnit);
  if (amount === null || amount <= 0 || !unit) return null;
  const factor = MASS_UNITS.get(sourceUnit) ?? VOLUME_UNITS.get(sourceUnit) ?? 1;
  return { amount: amount * factor, unit };
}

function quantityDescription(product, amount, unit, kind) {
  if (kind === "serving") {
    return text(product.serving_size) || `${amount} ${unit}`;
  }
  if (kind === "unit") {
    return `${amount} ${unit} por unidad${text(product.quantity) ? ` (${text(product.quantity)})` : ""}`;
  }
  if (kind === "package") {
    return `Contenido del envase: ${amount} ${unit}. Ajusta la cantidad si no vas a consumirlo entero.`;
  }
  return `Introduce la cantidad en ${unit === "g" ? "gramos" : "mililitros"}.`;
}

export function normalizeOpenFoodFacts(payload, value) {
  const code = normalizeBarcode(value);
  const product = payload && typeof payload === "object" ? payload.product : null;
  if (payload?.status === 0 || payload?.status === "failure" || !product || typeof product !== "object") {
    throw productError("product_not_found", "No se encontró este producto en Open Food Facts.");
  }

  const sourceCode = typeof product.code === "string" || typeof product.code === "number"
    ? String(product.code).trim()
    : "";
  if (sourceCode !== code) {
    throw productError("incomplete_product", "Open Food Facts devolvió una ficha sin un código de barras coincidente.");
  }

  const nombre = text(product.product_name_es)
    || text(product.product_name)
    || text(product.generic_name_es)
    || text(product.generic_name);
  if (!nombre) {
    throw productError("incomplete_product", "La ficha de Open Food Facts no incluye un nombre de producto.");
  }

  const quantityMeasure = parseMeasure(product.quantity);
  const packageUnit = knownUnit(product.product_quantity_unit)
    || (parseMultipack(product.quantity)?.unit ?? quantityMeasure?.unit);
  const servingMeasure = servingQuantity(product);
  const servingTextMeasure = parseMeasure(product.serving_size);
  const unit = packageUnit
    || servingMeasure?.unit
    || servingTextMeasure?.unit
    || null;
  if (!unit) {
    throw productError("incomplete_product", "Open Food Facts no indica si las cantidades del producto son gramos o mililitros.");
  }

  let amount = null;
  let amountKind = null;
  if (servingMeasure?.unit === unit) {
    amount = servingMeasure.amount;
    amountKind = "serving";
  } else if (servingTextMeasure?.unit === unit) {
    amount = servingTextMeasure.amount;
    amountKind = "serving";
  } else {
    const individualUnit = parseMultipack(product.quantity);
    if (individualUnit?.unit === unit) {
      amount = individualUnit.amount;
      amountKind = "unit";
    }
  }
  if (amount === null && quantityMeasure?.unit === unit) {
    amount = quantityMeasure.amount;
    amountKind = "package";
  }
  const packageAmount = numericValue(product.product_quantity);
  if (amount === null && !text(product.quantity) && packageAmount > 0
    && text(product.product_quantity_unit).toLowerCase() === unit) {
    amount = packageAmount;
    amountKind = "package";
  }

  const nutriments = product.nutriments && typeof product.nutriments === "object"
    ? product.nutriments
    : {};
  const now = new Date().toISOString();
  return {
    id: `barcode:${code}`,
    codigo_barras: code,
    nombre,
    marca: text(product.brands) || null,
    carbs_100g: nutrient100g(nutriments, "carbohydrates"),
    grasas_100g: nutrient100g(nutriments, "fat"),
    proteinas_100g: nutrient100g(nutriments, "proteins"),
    unidad_cantidad: unit,
    cantidad_sugerida: amount,
    descripcion_cantidad: quantityDescription(product, amount, unit, amountKind),
    fuente: "Open Food Facts",
    fuente_url: `https://world.openfoodfacts.org/product/${code}`,
    consultado_en: now,
    fecha_revision: null,
  };
}

/** Validate user-entered label data; provenance is assigned here, never by the client. */
export function normalizeManualProduct(value, barcode) {
  const code = normalizeBarcode(barcode);
  const fields = new Set(["nombre", "unidad_cantidad", "carbs_100g", "grasas_100g", "proteinas_100g"]);
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some((key) => !fields.has(key))) {
    throw productError("invalid_manual_product", "La ficha manual contiene campos no permitidos.");
  }
  const nombre = text(value.nombre);
  if (!nombre || nombre.length > 250) {
    throw productError("invalid_manual_product", "Indica un nombre de producto de hasta 250 caracteres.");
  }
  if (value.unidad_cantidad !== "g" && value.unidad_cantidad !== "ml") {
    throw productError("invalid_manual_product", "Indica si los valores de la etiqueta son por 100 g o por 100 ml.");
  }
  const nutrients = {};
  for (const key of ["carbs_100g", "grasas_100g", "proteinas_100g"]) {
    const number = value[key] ?? null;
    if (number === null ? key === "carbs_100g"
      : typeof number !== "number" || !Number.isFinite(number) || number < 0 || number > 100) {
      throw productError("invalid_manual_product", "Los hidratos son obligatorios y los nutrientes deben estar entre 0 y 100 g. Deja los desconocidos vacíos.");
    }
    nutrients[key] = number;
  }
  return {
    id: `barcode:${code}`,
    codigo_barras: code,
    nombre,
    marca: null,
    ...nutrients,
    unidad_cantidad: value.unidad_cantidad,
    cantidad_sugerida: null,
    descripcion_cantidad: "Indica la cantidad que vas a consumir según la etiqueta.",
    fuente: "Usuario (etiqueta; sin verificar)",
    fuente_url: null,
    consultado_en: new Date().toISOString(),
    fecha_revision: null,
  };
}
