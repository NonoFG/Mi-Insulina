import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "./index.ts";

const code = "4006381333931";
const origin = "https://app.example";
const manual = { nombre: "Yogur", unidad_cantidad: "ml", carbs_100g: 0, grasas_100g: null, proteinas_100g: 4 };
const env = (name) => ({ APP_ORIGIN: origin, SUPABASE_URL: "https://db.example", SUPABASE_SECRET_KEYS: '{"default":"server-secret"}' })[name];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const request = (body) => new Request("https://app.example/guardar-producto", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("guarda una ficha manual validada sin contactar OFF ni falsificar su procedencia", async () => {
  let inserted;
  const handler = createHandler({ env, fetchImpl: async (url, options) => {
    assert.ok(String(url).startsWith("https://db.example/rest/v1/productos_escaneados"));
    if (options.method === "GET") return json([]);
    inserted = JSON.parse(options.body);
    return json([inserted], 201);
  } });
  const response = await handler(request({ codigo_barras: code, producto_manual: manual }));
  assert.equal(response.status, 201);
  assert.equal(inserted.id, `barcode:${code}`);
  assert.equal(inserted.fuente, "Usuario (etiqueta; sin verificar)");
  assert.equal(inserted.fuente_url, null);
  assert.equal(inserted.registro_off, null);
  assert.equal(inserted.carbs_100g, 0);
  assert.equal(inserted.grasas_100g, null);
  assert.equal((await response.json()).product.nombre, manual.nombre);
});

for (const patch of [{ nombre: " " }, { carbs_100g: null }, { carbs_100g: 101 }, { grasas_100g: -1 }, { proteinas_100g: "4" }, { unidad_cantidad: "kg" }, { fuente: "Open Food Facts" }]) {
  test(`rechaza el alta manual inválida ${JSON.stringify(patch)}`, async () => {
    const handler = createHandler({ env, fetchImpl: async () => { assert.fail("No debe acceder a la BD con datos inválidos"); } });
    const response = await handler(request({ codigo_barras: code, producto_manual: { ...manual, ...patch } }));
    assert.equal(response.status, 422);
  });
}

test("un código existente conserva la ficha guardada y no admite sobrescritura", async () => {
  const existing = { ...manual, codigo_barras: code, id: `barcode:${code}`, nombre: "Ficha existente", fuente: "Usuario (etiqueta; sin verificar)" };
  const handler = createHandler({ env, fetchImpl: async (_url, options) => { assert.equal(options.method, "GET"); return json([existing]); } });
  const response = await handler(request({ codigo_barras: code, producto_manual: manual }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).product.nombre, existing.nombre);
});

test("un fallo de escritura no devuelve un guardado ficticio", async () => {
  const handler = createHandler({ env, fetchImpl: async (_url, options) => options.method === "GET" ? json([]) : json({}, 503) });
  const response = await handler(request({ codigo_barras: code, producto_manual: manual }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "storage_unavailable");
});
