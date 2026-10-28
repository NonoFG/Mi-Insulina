import test from "node:test";
import assert from "node:assert/strict";
import { lookupProduct } from "./products.js";

const code = "4006381333931";
const manual = { nombre: "Yogur de etiqueta", unidad_cantidad: "ml", carbs_100g: 0, grasas_100g: null, proteinas_100g: 4 };
const stored = { ...manual, id: `barcode:${code}`, codigo_barras: code, fuente: "Usuario (etiqueta; sin verificar)", fuente_url: null, consultado_en: "2026-10-23T00:00:00.000Z", cantidad_sugerida: null };
const off = { status: 1, product: { code, product_name: "Producto OFF", quantity: "100 g", nutriments: { carbohydrates_100g: 12 } } };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

function useFetch(t, implementation) {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  t.after(() => { globalThis.fetch = original; });
}

test("consulta primero Open Food Facts sin sustituir su ficha por una guardada", async (t) => {
  useFetch(t, async (url) => String(url).includes("openfoodfacts.org") ? json(off) : json([stored]));
  const result = await lookupProduct(code);
  assert.equal(result.product.nombre, "Producto OFF");
  assert.equal(result.saved, false);
});

test("recupera de Supabase un código ausente en Open Food Facts sin atribuirlo a OFF", async (t) => {
  useFetch(t, async (url) => String(url).includes("openfoodfacts.org") ? json({ status: 0 }, 404) : json([stored]));
  const result = await lookupProduct(code);
  assert.equal(result.saved, true);
  assert.equal(result.product.fuente, stored.fuente);
  assert.equal(result.product.fuente_url, null);
  assert.equal(result.product.carbs_100g, 0);
  assert.equal(result.product.grasas_100g, null);
});

for (const status of [200, 404]) {
  test(`ofrece alta solo tras confirmar ausencia en ambas fuentes (OFF ${status})`, async (t) => {
    useFetch(t, async (url) => String(url).includes("openfoodfacts.org") ? json({ status: 0 }, status) : json([]));
    await assert.rejects(lookupProduct(code), (error) => error.code === "product_not_found" && /Supabase/.test(error.message));
  });
}

test("un fallo de Supabase no afirma que el producto no existe", async (t) => {
  useFetch(t, async (url) => String(url).includes("openfoodfacts.org") ? json({ status: 0 }, 404) : json({}, 503));
  await assert.rejects(lookupProduct(code), (error) => error.code === "storage_unavailable");
});

test("no confunde una API OFF caída con un código ausente", async (t) => {
  useFetch(t, async (url) => String(url).includes("openfoodfacts.org") ? json({}, 503) : json([stored]));
  await assert.rejects(lookupProduct(code), /Open Food Facts no está disponible/);
});

