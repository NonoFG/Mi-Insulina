export const GRAMOS_HC_POR_RACION_REFERENCIA = 10;

// Solo para convertir comidas guardadas con el selector antiguo en alimentos.
// Se conservan sus HC originales, sin atribuirles una fuente nutricional externa.
const COMIDAS_ANTIGUAS = Object.freeze({
  "gyozas": Object.freeze({ nombre: "Gyozas (230 g)", hidratos: 52.9, gramos: 230 }),
  "ensalada-cesar": Object.freeze({ nombre: "Ensalada César (210 g)", hidratos: 14.7, gramos: 210 }),
  "patatas-de-lux": Object.freeze({ nombre: "Patatas de lujo (375 g, media bolsa)", hidratos: 86.3, gramos: 375 }),
});

export function migrarComidaGuardada(comida) {
  if (!comida || typeof comida !== "object"
    || (!Object.hasOwn(comida, "confort") && !Object.hasOwn(comida, "porcionesConfort"))) return comida;
  const { confort, porcionesConfort, ...actual } = comida;
  const anterior = Object.hasOwn(COMIDAS_ANTIGUAS, confort) ? COMIDAS_ANTIGUAS[confort] : null;
  if (anterior) {
    const porciones = numeroFinito(porcionesConfort);
    actual.alimentos = [...(Array.isArray(comida.alimentos) ? comida.alimentos : []), {
      id: `migrado-confort-${confort}`,
      alimento: {
        id: `migrado-confort-${confort}`,
        nombre: anterior.nombre,
        carbs_100g: anterior.hidratos * 100 / anterior.gramos,
        fuente: "Valor conservado de la aplicación original; sin fuente nutricional verificada.",
      },
      gramos: anterior.gramos * (porciones !== null && porciones >= 0 ? porciones : 1),
    }];
  }
  return actual;
}

const CAMPOS = Object.freeze({
  hidratos: ["carbs_100g", "carbs100g", "carbsPer100", "hidratos_100g", "hc_100g"],
  grasas: ["grasas_100g", "grasas100g", "grasa_100g", "grasas", "fat_100g", "fats100g"],
  proteinas: ["proteinas_100g", "proteinas100g", "proteina_100g", "proteinas", "protein_100g", "proteins100g"],
  gramosPorRacion: ["gramos_1_racion_hc", "gramos1RacionHC", "gramos_1_racion"],
});

export function numeroFinito(valor) {
  if (valor === null || valor === undefined || (typeof valor === "string" && valor.trim() === "")) return null;
  const numero = typeof valor === "number" ? valor : Number(String(valor).trim().replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

function primerValor(alimento, campos) {
  for (const campo of campos) {
    const valor = alimento?.[campo];
    if (valor !== null && valor !== undefined && !(typeof valor === "string" && valor.trim() === "")) {
      return valor;
    }
  }
  return null;
}

export function getDatoNutricional(alimento, nutriente) {
  const valor = numeroFinito(primerValor(alimento, CAMPOS[nutriente] || []));
  return valor !== null && valor >= 0 ? valor : null;
}

function esSinHidratos(alimento) {
  const valor = primerValor(alimento, CAMPOS.gramosPorRacion);
  return typeof valor === "string" && /sin\s*hc|sin\s*h(?:idratos)?\s*de\s*carbono/i.test(valor.trim());
}

function getGramosPorRacionDeAlimento(alimento) {
  return numeroFinito(primerValor(alimento, CAMPOS.gramosPorRacion));
}

export function nombreAlimento(alimento) {
  return String(alimento?.alimento ?? alimento?.nombre ?? alimento?.name ?? "Alimento sin nombre");
}

/** Calcula una porción conservando desconocidos como null, nunca como cero. */
export function calcularAlimento(alimento, gramos, gramosPorRacion) {
  const cantidad = numeroFinito(gramos);
  const equivalencia = numeroFinito(gramosPorRacion);
  if (cantidad === null || cantidad < 0) throw new RangeError("Los gramos deben ser un número finito no negativo.");
  if (equivalencia === null || equivalencia <= 0) throw new RangeError("La equivalencia debe ser un número finito mayor que cero.");

  const hidratos100 = getDatoNutricional(alimento, "hidratos");
  const gramosPorRacionAlimento = getGramosPorRacionDeAlimento(alimento);
  let hidratos = null;
  let origenHidratos = null;

  if (hidratos100 !== null) {
    hidratos = cantidad * hidratos100 / 100;
    origenHidratos = "composición por 100 g";
  } else if (esSinHidratos(alimento) || gramosPorRacionAlimento === 0) {
    hidratos = 0;
    origenHidratos = "dato explícito sin hidratos";
  } else if (gramosPorRacionAlimento !== null && gramosPorRacionAlimento > 0) {
    // Los gramos por ración existentes describen una ración histórica de 10 g HC.
    hidratos = cantidad * GRAMOS_HC_POR_RACION_REFERENCIA / gramosPorRacionAlimento;
    origenHidratos = "equivalencia original de 10 g HC/ración";
  }

  return {
    nombre: nombreAlimento(alimento),
    gramos: cantidad,
    hidratos,
    raciones: hidratos === null ? null : hidratos / equivalencia,
    grasas: getDatoNutricional(alimento, "grasas") === null
      ? null : cantidad * getDatoNutricional(alimento, "grasas") / 100,
    proteinas: getDatoNutricional(alimento, "proteinas") === null
      ? null : cantidad * getDatoNutricional(alimento, "proteinas") / 100,
    origenHidratos,
  };
}

/** Calcula una comida completa a partir de gramos HC canónicos. */
export function calcularComida({
  alimentos = [],
  hidratosExtra = 0,
  gramosPorRacion = 10,
} = {}) {
  const equivalencia = numeroFinito(gramosPorRacion);
  const extra = numeroFinito(hidratosExtra);
  if (equivalencia === null || equivalencia <= 0) throw new RangeError("La equivalencia debe ser un número finito mayor que cero.");
  if (extra === null || extra < 0) throw new RangeError("Los hidratos extra deben ser un número finito no negativo.");

  const detallesAlimentos = alimentos.map((entrada) => {
    const datos = calcularAlimento(entrada.alimento, entrada.gramos, equivalencia);
    if (datos.hidratos === null) {
      throw new RangeError(`${datos.nombre} no tiene hidratos calculables.`);
    }
    return { id: entrada.id, ...datos };
  });

  const carbohidratosAlimentos = detallesAlimentos.reduce((total, entrada) => total + entrada.hidratos, 0);
  const totalCarbohidratos = carbohidratosAlimentos + extra;
  const totalRaciones = totalCarbohidratos / equivalencia;
  const grasasCompletas = detallesAlimentos.every((entrada) => entrada.grasas !== null);
  const proteinasCompletas = detallesAlimentos.every((entrada) => entrada.proteinas !== null);

  return {
    equivalencia,
    alimentos: detallesAlimentos,
    extra: { hidratos: extra, raciones: extra / equivalencia },
    total: { hidratos: totalCarbohidratos, raciones: totalRaciones },
    macronutrientes: {
      grasas: grasasCompletas ? detallesAlimentos.reduce((total, entrada) => total + entrada.grasas, 0) : null,
      proteinas: proteinasCompletas ? detallesAlimentos.reduce((total, entrada) => total + entrada.proteinas, 0) : null,
    },
  };
}

export function calcularUGP(gramosGrasas, gramosProteinas, kcalGrasa, kcalProteina, kcalPorUgp) {
  const valores = [gramosGrasas, gramosProteinas, kcalGrasa, kcalProteina, kcalPorUgp].map(numeroFinito);
  if (valores.some((valor) => valor === null || valor < 0) || valores[4] === 0) {
    throw new RangeError("Los nutrientes y factores deben ser finitos y no negativos; las kcal por UGP deben ser mayores que cero.");
  }
  const [grasas, proteinas, factorGrasa, factorProteina, factorUgp] = valores;
  const kcal = grasas * factorGrasa + proteinas * factorProteina;
  return { kcal, ugp: kcal / factorUgp };
}
