import test from "node:test";
import assert from "node:assert/strict";
import {
  migrarComidaGuardada,
  calcularAlimento,
  calcularComida,
} from "./calculos.js";

const cerca = (actual, esperado) => assert.ok(Math.abs(actual - esperado) < 1e-9, `${actual} no coincide con ${esperado}`);

test("la equivalencia configurable recalcula raciones desde gramos HC invariables", () => {
  const arroz = { alimento: "Arroz", carbs_100g: 26.3, grasas_100g: 0.3, proteinas_100g: 2.7 };
  const gramosHC = calcularAlimento(arroz, 200, 10).hidratos;
  const diez = calcularComida({ alimentos: [{ id: "arroz", alimento: arroz, gramos: 200 }], gramosPorRacion: 10 });
  const veinte = calcularComida({ alimentos: [{ id: "arroz", alimento: arroz, gramos: 200 }], gramosPorRacion: 20 });
  cerca(gramosHC, 52.6);
  cerca(diez.total.hidratos, veinte.total.hidratos);
  cerca(diez.total.raciones, 5.26);
  cerca(veinte.total.raciones, 2.63);
});
test("una equivalencia de ración del catálogo conserva los mismos gramos HC al cambiar el ajuste", () => {
  const arroz = { alimento: "Arroz blanco hervido", gramos_1_racion_hc: 38 };
  const diez = calcularAlimento(arroz, 76, 10);
  const veinte = calcularAlimento(arroz, 76, 20);
  cerca(diez.hidratos, 20);
  cerca(veinte.hidratos, 20);
  cerca(diez.raciones, 2);
  cerca(veinte.raciones, 1);
});

test("las comidas antiguas se convierten en alimentos editables sin perder ni duplicar HC", () => {
  const casos = [
    ["gyozas", 52.9, 230],
    ["ensalada-cesar", 14.7, 210],
    ["patatas-de-lux", 86.3, 375],
  ];
  for (const [confort, hidratos, gramos] of casos) {
    const comida = migrarComidaGuardada({
      confort,
      porcionesConfort: 2.5,
      alimentos: [{ id: "arroz", alimento: { carbs_100g: 20, grasas_100g: 1, proteinas_100g: 3 }, gramos: 100 }],
      hidratosExtra: 12,
    });
    const diez = calcularComida({ ...comida, gramosPorRacion: 10 });
    const veinte = calcularComida({ ...migrarComidaGuardada(comida), gramosPorRacion: 20 });
    cerca(comida.alimentos.at(-1).gramos, gramos * 2.5);
    cerca(diez.total.hidratos, hidratos * 2.5 + 32);
    cerca(veinte.total.hidratos, diez.total.hidratos);
    cerca(veinte.total.raciones, diez.total.hidratos / 20);
    assert.equal(diez.macronutrientes.grasas, null);
    assert.equal(diez.macronutrientes.proteinas, null);
  }
});

test("la conversión conserva cero porciones y los valores predeterminados de los guardados antiguos", () => {
  for (const [porcionesConfort, hidratos] of [[0, 0], [undefined, 52.9], [-1, 52.9], ["inválido", 52.9]]) {
    const comida = migrarComidaGuardada({ confort: "gyozas", porcionesConfort });
    cerca(calcularComida(comida).total.hidratos, hidratos);
  }
});

test("un nutriente igual a cero se distingue de uno desconocido o vacío", () => {
  const cero = calcularAlimento({ alimento: "Alimento sin HC", carbs_100g: 0, grasas_100g: 0 }, 100, 10);
  const desconocido = calcularAlimento({ alimento: "Alimento sin datos" }, 100, 10);
  const campoVacio = calcularAlimento({ alimento: "Alimento con campo vacío", carbs_100g: " " }, 100, 10);
  const cantidadCero = calcularAlimento({ alimento: "Alimento conocido", carbs_100g: 10 }, 0, 10);
  assert.equal(cero.hidratos, 0);
  assert.equal(cero.grasas, 0);
  assert.equal(desconocido.hidratos, null);
  assert.equal(desconocido.grasas, null);
  assert.equal(desconocido.proteinas, null);
  assert.equal(campoVacio.hidratos, null);
  assert.equal(cantidadCero.hidratos, 0);
  assert.throws(() => calcularComida({ alimentos: [{ alimento: { alimento: "Desconocido" }, gramos: 100 }] }), /no tiene hidratos calculables/);
});
test("un alimento aporta una sola entrada y editar sus gramos actualiza el total", () => {
  const alimento = { alimento: "Arroz", carbs_100g: 25 };
  const porcion = (gramos) => calcularComida({ alimentos: [{ id: "unica", alimento, gramos }], gramosPorRacion: 10 });
  const original = porcion(100);
  const editado = porcion(40);
  assert.equal(original.alimentos.length, 1);
  assert.equal(editado.alimentos.length, 1);
  cerca(original.total.hidratos, 25);
  cerca(editado.total.hidratos, 10);
  cerca(editado.total.raciones, 1);
});

test("la ración extra se convierte a gramos HC al introducirla y los conserva al cambiar equivalencia", () => {
  const hcExtraGuardados = 1.2 * 10;
  const diez = calcularComida({ alimentos: [{ id: "arroz", alimento: { carbs_100g: 20 }, gramos: 100 }], hidratosExtra: hcExtraGuardados, gramosPorRacion: 10 });
  const veinte = calcularComida({ alimentos: [{ id: "arroz", alimento: { carbs_100g: 20 }, gramos: 100 }], hidratosExtra: hcExtraGuardados, gramosPorRacion: 20 });
  cerca(diez.extra.hidratos, 12);
  cerca(veinte.extra.hidratos, 12);
  cerca(diez.extra.raciones, 1.2);
  cerca(veinte.extra.raciones, 0.6);
  cerca(diez.total.hidratos, veinte.total.hidratos);
  assert.equal(veinte.alimentos.length, 1);
});

test("cantidades negativas, no finitas y equivalencias inválidas no producen resultados", () => {
  assert.throws(() => calcularAlimento({ carbs_100g: 10 }, -1, 10), RangeError);
  assert.throws(() => calcularAlimento({ carbs_100g: 10 }, Infinity, 10), RangeError);
  assert.throws(() => calcularComida({ hidratosExtra: -1 }), RangeError);
  assert.throws(() => calcularComida({ hidratosExtra: NaN }), RangeError);
  assert.throws(() => calcularComida({ gramosPorRacion: 0 }), RangeError);
});
