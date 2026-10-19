import { SUPABASE_CONFIG } from "./supabase-config.js";

const PAGE_SIZE = 1000;
const DATABASE_NAME = "mi-insulina-offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "catalogos";
const CACHE_KEY = "alimentos";

function informar(onStatus, status) {
  if (typeof onStatus !== "function") return;
  try {
    onStatus(status);
  } catch {
    // Un error de presentación no debe impedir cargar el catálogo.
  }
}

function errorDeCarga(detalle = "") {
  const sufijo = detalle ? ` (${detalle})` : "";
  return new Error(`No se pudo cargar el catálogo de Supabase${sufijo}. Comprueba la conexión y vuelve a intentarlo.`);
}

function validarAlimentos(foods) {
  if (!Array.isArray(foods) || foods.length === 0) return false;
  const ids = new Set();
  return foods.every((food) => {
    if (!food || typeof food !== "object" || Array.isArray(food)) return false;
    const idValido = (typeof food.id === "string" && food.id.trim() !== "")
      || (typeof food.id === "number" && Number.isFinite(food.id));
    if (!idValido || typeof food.nombre !== "string" || !food.nombre.trim()) return false;
    const id = String(food.id);
    if (ids.has(id)) return false;
    ids.add(id);
    return true;
  });
}

function abrirBaseDeDatos() {
  if (!globalThis.indexedDB) return Promise.reject(new Error("IndexedDB no está disponible"));
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onerror = () => reject(request.error || new Error("No se pudo abrir IndexedDB"));
    request.onblocked = () => reject(new Error("La base de datos local está bloqueada"));
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

async function leerCatalogoGuardado() {
  let database;
  try {
    database = await abrirBaseDeDatos();
    const record = await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(CACHE_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error || new Error("No se pudo leer el catálogo guardado"));
      transaction.onabort = () => reject(transaction.error || new Error("Lectura local cancelada"));
    });
    if (!record || !validarAlimentos(record.foods) || !Number.isFinite(Date.parse(record.fetchedAt))) return null;
    return record;
  } catch {
    return null;
  } finally {
    database?.close();
  }
}

async function guardarCatalogo(foods, fetchedAt) {
  let database;
  try {
    database = await abrirBaseDeDatos();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ foods, fetchedAt }, CACHE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("No se pudo guardar el catálogo"));
      transaction.onabort = () => reject(transaction.error || new Error("Guardado local cancelado"));
    });
    return true;
  } catch {
    return false;
  } finally {
    database?.close();
  }
}

function interpretarRango(response) {
  const header = response.headers.get("content-range");
  const match = header?.match(/^\s*(\d+)-(\d+)\/(\d+|\*)\s*$/);
  if (match) {
    return {
      start: Number(match[1]),
      end: Number(match[2]),
      total: match[3] === "*" ? null : Number(match[3]),
    };
  }
  const emptyMatch = header?.match(/^\s*\*\/(\d+|\*)\s*$/);
  if (!emptyMatch) return null;
  return { start: null, end: null, total: emptyMatch[1] === "*" ? null : Number(emptyMatch[1]) };
}

async function detalleHttp(response) {
  let text = "";
  try {
    text = (await response.text()).trim();
  } catch {
    return `HTTP ${response.status}`;
  }
  if (!text) return `HTTP ${response.status}`;
  try {
    const body = JSON.parse(text);
    text = body.message || body.details || body.hint || text;
  } catch {
    // El cuerpo puede ser texto plano.
  }
  return `HTTP ${response.status}: ${String(text).slice(0, 180)}`;
}
async function cargarAlimentosCompletos() {
  const baseUrl = SUPABASE_CONFIG.url.trim().replace(/\/$/, "");
  const anonKey = SUPABASE_CONFIG.anonKey.trim();
  if (!baseUrl || !anonKey) throw errorDeCarga("falta la configuración pública de Supabase");

  const endpoint = new URL(`/rest/v1/${encodeURIComponent(SUPABASE_CONFIG.table)}`, baseUrl);
  endpoint.searchParams.set("select", SUPABASE_CONFIG.select);
  endpoint.searchParams.set("order", "nombre.asc,id.asc");

  const foods = [];
  const ids = new Set();
  let offset = 0;
  let totalEsperado = null;

  while (true) {
    const end = offset + PAGE_SIZE - 1;
    const response = await fetch(endpoint, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        apikey: anonKey,
        "Range-Unit": "items",
        Range: `${offset}-${end}`,
        ...(offset === 0 ? { Prefer: "count=exact" } : {}),
      },
    });
    if (!response.ok) throw errorDeCarga(await detalleHttp(response));

    let page;
    try {
      page = await response.json();
    } catch {
      throw errorDeCarga("la respuesta no contiene JSON válido");
    }
    if (!Array.isArray(page)) throw errorDeCarga("la respuesta no es una lista de alimentos");

    const range = interpretarRango(response);
    if (range?.total !== null && range?.total !== undefined) {
      if (totalEsperado !== null && range.total !== totalEsperado) {
        throw errorDeCarga("el total de alimentos cambió durante la paginación");
      }
      totalEsperado = range.total;
    }
    if (range && range.start !== null && range.start !== offset) {
      throw errorDeCarga(`la paginación empezó en ${range.start} en lugar de ${offset}`);
    }
    if (range && page.length > 0 && range.end - range.start + 1 !== page.length) {
      throw errorDeCarga("la respuesta de paginación está incompleta");
    }
    if (page.length === 0) {
      if (totalEsperado !== null && offset < totalEsperado) {
        throw errorDeCarga(`faltan alimentos en la página ${offset}`);
      }
      break;
    }

    for (const food of page) {
      if (!food || typeof food !== "object" || Array.isArray(food)) {
        throw errorDeCarga("la respuesta contiene una fila no válida");
      }
      const validId = (typeof food.id === "string" && food.id.trim() !== "")
        || (typeof food.id === "number" && Number.isFinite(food.id));
      if (!validId || typeof food.nombre !== "string" || !food.nombre.trim()) {
        throw errorDeCarga("la respuesta contiene un alimento sin identificador o nombre");
      }
      const id = String(food.id);
      if (ids.has(id)) throw errorDeCarga("la paginación repitió alimentos; no se guardó una lista parcial");
      ids.add(id);
      foods.push(food);
    }

    offset += page.length;
    if (totalEsperado !== null) {
      if (offset > totalEsperado) throw errorDeCarga("la paginación superó el total informado por Supabase");
      if (offset === totalEsperado) break;
    }
  }

  if (!validarAlimentos(foods)) throw errorDeCarga("el catálogo recibido está vacío o incompleto");
  return foods;
}

/**
 * Carga el catálogo público completo, lo conserva crudo y usa una copia local
 * validada cuando la conexión no está disponible.
 */
export async function loadCatalog({ onStatus } = {}) {
  informar(onStatus, { state: "loading", cached: false, stale: false });

  try {
    const foods = await cargarAlimentosCompletos();
    const fetchedAt = new Date().toISOString();
    const cached = await guardarCatalogo(foods, fetchedAt);
    const result = {
      foods, fetchedAt, cached: false, stale: false, cacheSaved: cached,
      message: cached ? "Catálogo actualizado y guardado para uso sin conexión." : "Catálogo actualizado; no se pudo guardar una copia local.",
    };
    informar(onStatus, { state: "fresh", ...result });
    return result;
  } catch (cause) {
    const networkError = cause instanceof Error ? cause : errorDeCarga();
    const saved = await leerCatalogoGuardado();
    if (saved) {
      const result = {
        foods: saved.foods, fetchedAt: saved.fetchedAt, cached: true, stale: true,
        message: `${networkError.message} Se usa el catálogo guardado; vuelve a intentar cuando haya conexión.`,
      };
      informar(onStatus, { state: "stale", ...result });
      return result;
    }

    const error = networkError.message.includes("No se pudo cargar el catálogo")
      ? networkError
      : errorDeCarga(networkError.message);
    informar(onStatus, { state: "error", cached: false, stale: true, message: error.message });
    throw error;
  }
}
