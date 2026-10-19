import { SUPABASE_CONFIG } from "./supabase-config.js";
import {
  normalizeBarcode,
  normalizeOpenFoodFacts,
} from "./product-data.js";

const PRODUCT_TABLE = "productos_escaneados";
const OFF_FIELDS = [
  "code",
  "product_name",
  "product_name_es",
  "generic_name",
  "generic_name_es",
  "brands",
  "quantity",
  "product_quantity",
  "product_quantity_unit",
  "serving_size",
  "serving_quantity",
  "serving_quantity_unit",
  "nutrition_data_per",
  "nutriments",
  "no_nutrition_data",
].join(",");
const PAGE_SIZE = 1000;

function supabaseUrl(path) {
  const root = typeof SUPABASE_CONFIG?.url === "string" ? SUPABASE_CONFIG.url.replace(/\/+$/, "") : "";
  return root ? `${root}${path}` : null;
}

function supabaseHeaders() {
  const key = typeof SUPABASE_CONFIG?.anonKey === "string" ? SUPABASE_CONFIG.anonKey : "";
  if (!key) return null;
  return { apikey: key };
}

function abortError(error) {
  return error?.name === "AbortError";
}

function savedProduct(record, requestedCode = record?.codigo_barras) {
  const code = normalizeBarcode(requestedCode);
  if (!record || typeof record !== "object" || record.codigo_barras !== code || record.id !== `barcode:${code}`) {
    throw new Error("El producto guardado no coincide con el código de barras solicitado.");
  }
  if (typeof record.nombre !== "string" || !record.nombre.trim()) {
    throw new Error("El producto guardado no contiene un nombre válido.");
  }
  if (record.unidad_cantidad !== "g" && record.unidad_cantidad !== "ml") {
    throw new Error("El producto guardado contiene una unidad no válida.");
  }

  const nullableNumber = (value) => {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
  };
  const quantity = record.cantidad_sugerida === null || record.cantidad_sugerida === undefined
    || record.cantidad_sugerida === ""
    ? null
    : Number(record.cantidad_sugerida);

  return {
    id: `barcode:${code}`,
    codigo_barras: code,
    nombre: record.nombre.trim(),
    marca: typeof record.marca === "string" && record.marca.trim() ? record.marca.trim() : null,
    carbs_100g: nullableNumber(record.carbs_100g),
    grasas_100g: nullableNumber(record.grasas_100g),
    proteinas_100g: nullableNumber(record.proteinas_100g),
    unidad_cantidad: record.unidad_cantidad,
    cantidad_sugerida: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
    descripcion_cantidad: typeof record.descripcion_cantidad === "string"
      ? record.descripcion_cantidad
      : "",
    fuente: "Open Food Facts",
    fuente_url: typeof record.fuente_url === "string"
      ? record.fuente_url
      : `https://world.openfoodfacts.org/product/${code}`,
    consultado_en: typeof record.consultado_en === "string" ? record.consultado_en : null,
    fecha_revision: typeof record.fecha_revision === "string" ? record.fecha_revision : null,
  };
}

async function readSavedProduct(code, signal) {
  const url = supabaseUrl(`/rest/v1/${PRODUCT_TABLE}`);
  const headers = supabaseHeaders();
  if (!url || !headers) return { available: false, product: null };

  const query = new URLSearchParams({
    select: "*",
    codigo_barras: `eq.${code}`,
  });
  let response;
  try {
    response = await fetch(`${url}?${query}`, {
      method: "GET",
      headers,
      signal,
      cache: "no-store",
      credentials: "omit",
    });
  } catch (error) {
    if (abortError(error)) throw error;
    return { available: false, product: null };
  }
  if (!response.ok) return { available: false, product: null };

  let rows;
  try {
    rows = await response.json();
  } catch {
    return { available: false, product: null };
  }
  if (!Array.isArray(rows)) return { available: false, product: null };
  if (rows.length > 1) throw new Error("Hay más de un producto guardado con el mismo código de barras.");
  return {
    available: true,
    product: rows.length === 1 ? savedProduct(rows[0], code) : null,
  };
}

async function fetchOpenFoodFacts(code, signal) {
  const query = new URLSearchParams({ fields: OFF_FIELDS });
  // API 3.5+ cambió el esquema nutricional; 3.4 conserva los valores normalizados *_100g.
  const url = `https://world.openfoodfacts.org/api/v3.4/product/${encodeURIComponent(code)}.json?${query}`;
  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
      cache: "no-store",
      credentials: "omit",
    });
  } catch (error) {
    if (abortError(error)) throw error;
    throw new Error("No se pudo conectar con Open Food Facts. Comprueba tu conexión e inténtalo de nuevo.");
  }

  if (response.status === 404) {
    throw new Error("No se encontró este producto en Open Food Facts.");
  }
  if (response.status === 429) {
    throw new Error("Open Food Facts ha limitado temporalmente las consultas. Inténtalo más tarde.");
  }
  if (!response.ok) {
    throw new Error("Open Food Facts no está disponible en este momento.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Open Food Facts devolvió una respuesta que no se pudo leer.");
  }
  return normalizeOpenFoodFacts(payload, code);
}

export async function lookupProduct(value, { signal } = {}) {
  const code = normalizeBarcode(value);
  const stored = await readSavedProduct(code, signal);
  if (stored.product) {
    return { product: stored.product, saved: true, storageAvailable: true };
  }

  const product = await fetchOpenFoodFacts(code, signal);
  return { product, saved: false, storageAvailable: stored.available };
}

export async function saveProduct(value, { signal } = {}) {
  const code = normalizeBarcode(value);
  const url = supabaseUrl("/functions/v1/guardar-producto");
  const headers = supabaseHeaders();
  if (!url || !headers) {
    throw new Error("No está configurada la conexión segura para guardar productos.");
  }
  headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ codigo_barras: code }),
      signal,
      cache: "no-store",
      credentials: "omit",
    });
  } catch (error) {
    if (abortError(error)) throw error;
    throw new Error("No se pudo conectar con el servicio seguro de guardado.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : response.status === 404
        ? "El servicio seguro de guardado no está desplegado."
        : "No se pudo guardar el producto. Comprueba la configuración del servicio.";
    throw new Error(message);
  }

  const row = payload?.product ?? payload;
  return savedProduct(row, code);
}

export async function loadSavedProducts({ signal } = {}) {
  const url = supabaseUrl(`/rest/v1/${PRODUCT_TABLE}`);
  const headers = supabaseHeaders();
  if (!url || !headers) {
    throw new Error("El almacenamiento de productos no está configurado.");
  }

  const products = [];
  const seen = new Set();
  let start = 0;
  while (true) {
    const query = new URLSearchParams({
      select: "*",
      order: "nombre.asc,id.asc",
    });
    let response;
    try {
      response = await fetch(`${url}?${query}`, {
        method: "GET",
        headers: {
          ...headers,
          Range: `${start}-${start + PAGE_SIZE - 1}`,
          "Range-Unit": "items",
          Prefer: "count=exact",
        },
        signal,
        cache: "no-store",
        credentials: "omit",
      });
    } catch (error) {
      if (abortError(error)) throw error;
      throw new Error("No se pudieron cargar los productos guardados: el almacenamiento no está disponible.");
    }
    const totalMatch = response.headers.get("content-range")?.match(/\/(\d+)$/);
    const total = totalMatch ? Number(totalMatch[1]) : null;
    if (response.status === 416 && total === start) return products;
    if (!response.ok) {
      throw new Error("No se pudieron cargar los productos guardados: el almacenamiento no está disponible.");
    }

    let rows;
    try {
      rows = await response.json();
    } catch {
      throw new Error("No se pudieron leer los productos guardados.");
    }
    if (!Array.isArray(rows)) throw new Error("El almacenamiento devolvió una lista de productos no válida.");
    if (rows.length === 0) {
      if (total !== null && start < total) throw new Error("La lista de productos guardados está incompleta.");
      return products;
    }
    for (const row of rows) {
      const product = savedProduct(row);
      if (seen.has(product.id)) throw new Error("La lista de productos guardados repitió una página.");
      seen.add(product.id);
      products.push(product);
    }
    start += rows.length;
    if (total !== null && start >= total) {
      if (start > total) throw new Error("Cambió la lista de productos guardados durante la consulta.");
      return products;
    }
  }
}
