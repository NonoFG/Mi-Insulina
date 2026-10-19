import test from "node:test";
import assert from "node:assert/strict";
import { loadCatalog } from "./catalog.js";

const fila = (id) => ({ id, nombre: `Alimento ${String(id).padStart(4, "0")}`, carbs_100g: 25 });
const pagina = (filas, rango) => new Response(JSON.stringify(filas), {
  status: 206,
  headers: { "Content-Range": rango },
});

test("carga el catálogo completo aunque el servidor limite cada página por debajo del rango pedido", async (t) => {
  const inicioPaginas = [];
  t.mock.method(globalThis, "fetch", async (_url, opciones) => {
    const inicio = Number(opciones.headers.Range.split("-")[0]);
    inicioPaginas.push(inicio);
    const fin = Math.min(inicio + 699, 2499);
    return pagina(Array.from({ length: fin - inicio + 1 }, (_, indice) => fila(inicio + indice)), `${inicio}-${fin}/2500`);
  });
  const { foods } = await loadCatalog();
  assert.equal(foods.length, 2500);
  assert.equal(foods[699].id, 699);
  assert.equal(foods[700].id, 700);
  assert.equal(foods[2499].id, 2499);
  assert.deepEqual(inicioPaginas, [0, 700, 1400, 2100]);
});

test("rechaza un catálogo truncado en vez de devolver un resultado parcial como completo", async (t) => {
  let llamada = 0;
  t.mock.method(globalThis, "fetch", async () => ++llamada === 1
    ? pagina([fila(0), fila(1)], "0-1/3")
    : pagina([], "*/3"));
  await assert.rejects(loadCatalog(), /faltan alimentos/);
});

test("rechaza páginas que repiten alimentos en vez de duplicar el catálogo", async (t) => {
  let llamada = 0;
  t.mock.method(globalThis, "fetch", async () => ++llamada === 1
    ? pagina([fila(0), fila(1)], "0-1/4")
    : pagina([fila(1), fila(2)], "2-3/4"));
  await assert.rejects(loadCatalog(), /repitió alimentos/);
});
