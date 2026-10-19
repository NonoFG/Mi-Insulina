import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBarcode,
  normalizeOpenFoodFacts,
  ProductDataError,
} from "./product-data.js";

const EAN13 = "4006381333931";
const sample = () => ({
  status: "success",
  product: {
    code: EAN13,
    product_name: "Alimento de prueba",
    brands: "Marca",
    quantity: "500 g",
    product_quantity: "500",
    product_quantity_unit: "g",
    nutrition_data_per: "100g",
    nutriments: {
      carbohydrates_100g: 25,
      fat_100g: 4,
      proteins_100g: 8,
    },
  },
});

function product(overrides = {}) {
  const payload = sample();
  payload.product = { ...payload.product, ...overrides };
  return payload;
}

test("valida el dígito de control de EAN-8, UPC-A, EAN-13 y GTIN-14", () => {
  for (const code of ["96385074", "036000291452", EAN13, "10012345000017"]) {
    assert.equal(normalizeBarcode(code), code);
  }
  assert.equal(normalizeBarcode(` ${EAN13} `), EAN13);
});

test("rechaza códigos mal formados y dígitos de control incorrectos", () => {
  for (const code of ["123", "4006381333932", "400638133393X", "  "]) {
    assert.throws(() => normalizeBarcode(code), (error) => error instanceof ProductDataError && error.code === "invalid_barcode");
  }
  assert.throws(() => normalizeBarcode(4006381333931), ProductDataError);
});

test("normalizes explicit nutrients while preserving zero and unknown as distinct values", () => {
  const row = normalizeOpenFoodFacts(product({
    nutriments: {
      carbohydrates_100g: 0,
      fat_100g: null,
      proteins_100g: "7.25",
      sugars_100g: 18,
    },
  }), EAN13);

  assert.equal(row.carbs_100g, 0);
  assert.equal(row.grasas_100g, null);
  assert.equal(row.proteinas_100g, 7.25);
  assert.equal(row.codigo_barras, EAN13);
  assert.equal(row.id, `barcode:${EAN13}`);
  assert.equal(row.unidad_cantidad, "g");
});

test("does not infer carbohydrates from sugars or read prepared nutrition values", () => {
  const row = normalizeOpenFoodFacts(product({
    nutriments: {
      sugars_100g: 24,
      carbohydrates_value: 28,
      carbohydrates_prepared_100g: 35,
      fat_prepared_100g: 6,
      proteins_prepared_100g: 9,
    },
  }), EAN13);

  assert.equal(row.carbs_100g, null);
  assert.equal(row.grasas_100g, null);
  assert.equal(row.proteinas_100g, null);
});

test("prefers an explicit individual serving and preserves milliliters", () => {
  const row = normalizeOpenFoodFacts(product({
    quantity: "6 x 250 ml",
    product_quantity: "1500",
    product_quantity_unit: "ml",
    serving_quantity: "125",
    serving_quantity_unit: "ml",
    serving_size: "125 ml",
  }), EAN13);

  assert.equal(row.unidad_cantidad, "ml");
  assert.equal(row.cantidad_sugerida, 125);
  assert.equal(row.descripcion_cantidad, "125 ml");
});

test("uses one multipack unit rather than the aggregate package amount", () => {
  const row = normalizeOpenFoodFacts(product({
    quantity: "4 x 125 g (500 g)",
    product_quantity: "500",
    product_quantity_unit: "g",
    serving_quantity: undefined,
    serving_quantity_unit: undefined,
    serving_size: undefined,
  }), EAN13);

  assert.equal(row.cantidad_sugerida, 125);
  assert.match(row.descripcion_cantidad, /por unidad/);
});

test("un yogur individual propone los 125 g del envase sin exigir una porción adicional", () => {
  const row = normalizeOpenFoodFacts(product({
    quantity: undefined,
    product_quantity: 125,
    serving_quantity: undefined,
    serving_quantity_unit: undefined,
    serving_size: undefined,
  }), EAN13);

  assert.equal(row.unidad_cantidad, "g");
  assert.equal(row.cantidad_sugerida, 125);
});

test("converts volume quantities only within volume units and never guesses density", () => {
  const row = normalizeOpenFoodFacts(product({
    quantity: "6 x 25 cl",
    product_quantity: "1500",
    product_quantity_unit: "ml",
    serving_quantity: "0.25",
    serving_quantity_unit: "l",
    serving_size: "25 cl",
  }), EAN13);

  assert.equal(row.unidad_cantidad, "ml");
  assert.equal(row.cantidad_sugerida, 250);
});

test("rejects an unknown quantity basis instead of silently assuming grams", () => {
  assert.throws(
    () => normalizeOpenFoodFacts(product({
      quantity: "1 paquete",
      product_quantity: undefined,
      product_quantity_unit: undefined,
      serving_quantity: undefined,
      serving_quantity_unit: undefined,
      serving_size: undefined,
    }), EAN13),
    (error) => error instanceof ProductDataError && error.code === "incomplete_product",
  );
});

test("rejects missing products and a response for a different barcode", () => {
  assert.throws(() => normalizeOpenFoodFacts({ status: "failure" }, EAN13),
    (error) => error instanceof ProductDataError && error.code === "product_not_found");
  assert.throws(
    () => normalizeOpenFoodFacts(product({ code: "96385074" }), EAN13),
    (error) => error instanceof ProductDataError && error.code === "incomplete_product",
  );
});
