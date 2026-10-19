import { normalizeBarcode, normalizeOpenFoodFacts, ProductDataError } from "../../../product-data.js";

type HandlerDependencies = {
  env?: (name: string) => string | undefined;
  fetchImpl?: typeof fetch;
};

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

function configuredOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:")
      || url.pathname !== "/"
      || url.search
      || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function serviceRoleHeaders(readEnv: (name: string) => string | undefined): Record<string, string> | null {
  const secretKeys = readEnv("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const keys: unknown = JSON.parse(secretKeys);
      if (keys !== null && typeof keys === "object" && !Array.isArray(keys)
        && "default" in keys && typeof keys.default === "string" && keys.default.trim()) {
        return { apikey: keys.default };
      }
    } catch {
      return null;
    }
  }
  return null;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
  allowedOrigin: string | null,
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
  if (origin && allowedOrigin && origin === allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
  return new Response(JSON.stringify(body), { status, headers });
}


function productResponse(record: Record<string, unknown>): Record<string, unknown> {
  const product = { ...record };
  delete product.registro_off;
  delete product.created_at;
  return product;
}


function productErrorStatus(code: string): number {
  if (code === "invalid_barcode") return 400;
  if (code === "product_not_found") return 404;
  return 422;
}

export function createHandler(dependencies: HandlerDependencies = {}) {
  const readEnv = dependencies.env ?? ((name: string) => Deno.env.get(name));
  const requestFetch = dependencies.fetchImpl ?? fetch;

  return async function handler(request: Request): Promise<Response> {
    const origin = request.headers.get("Origin");
    const allowedOrigin = configuredOrigin(readEnv("APP_ORIGIN"));
    if (!allowedOrigin) {
      return jsonResponse(
        { code: "server_configuration", error: "Falta configurar APP_ORIGIN para habilitar el guardado seguro." },
        500,
        origin,
        null,
      );
    }

    if (!origin || origin !== allowedOrigin) {
      return jsonResponse(
        { code: "origin_forbidden", error: "El origen de esta solicitud no está autorizado." },
        403,
        origin,
        allowedOrigin,
      );
    }

    if (request.method === "OPTIONS") {
      const headers = new Headers({
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      });
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "POST") {
      return jsonResponse({ code: "method_not_allowed", error: "Usa una solicitud POST para guardar el producto." }, 405, origin, allowedOrigin);
    }
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
      return jsonResponse({ code: "invalid_request", error: "La solicitud debe contener únicamente un código de barras en formato JSON." }, 400, origin, allowedOrigin);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ code: "invalid_request", error: "No se pudo leer el código de barras de la solicitud." }, 400, origin, allowedOrigin);
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1
      || !("codigo_barras" in body)
      || typeof body.codigo_barras !== "string") {
      return jsonResponse({ code: "invalid_request", error: "La solicitud solo puede incluir un código de barras válido." }, 400, origin, allowedOrigin);
    }

    let code: string;
    try {
      code = normalizeBarcode(body.codigo_barras);
    } catch (error) {
      const failure = error instanceof ProductDataError
        ? error
        : new ProductDataError("invalid_barcode", "El código de barras no es válido.");
      return jsonResponse({ code: failure.code, error: failure.message }, productErrorStatus(failure.code), origin, allowedOrigin);
    }

    const supabaseUrl = readEnv("SUPABASE_URL")?.replace(/\/+$/, "");
    const privilegedHeaders = serviceRoleHeaders(readEnv);
    if (!supabaseUrl || !privilegedHeaders) {
      return jsonResponse({ code: "server_configuration", error: "Falta configurar el acceso privado a la base de datos." }, 500, origin, allowedOrigin);
    }
    const headers = {
      ...privilegedHeaders,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Profile": "public",
      "Content-Profile": "public",
    };
    const tableUrl = `${supabaseUrl}/rest/v1/productos_escaneados`;
    const queryExisting = async (): Promise<{ available: boolean; product: Record<string, unknown> | null }> => {
      const query = new URLSearchParams({
        select: "*",
        codigo_barras: `eq.${code}`,
      });
      let response: Response;
      try {
        response = await requestFetch(`${tableUrl}?${query}`, {
          method: "GET",
          headers,
          signal: request.signal,
        });
      } catch {
        return { available: false, product: null };
      }
      if (!response.ok) return { available: false, product: null };
      try {
        const rows: unknown = await response.json();
        if (!Array.isArray(rows) || rows.length > 1) return { available: false, product: null };
        if (rows.length === 0) return { available: true, product: null };
        const row = rows[0];
        if (!row || typeof row !== "object" || Array.isArray(row)) return { available: false, product: null };
        const product = row as Record<string, unknown>;
        return { available: true, product };
      } catch {
        return { available: false, product: null };
      }
    };

    const existing = await queryExisting();
    if (!existing.available) {
      return jsonResponse(
        { code: "storage_unavailable", error: "El almacenamiento de productos no está disponible. Aplica primero la migración de Supabase." },
        503,
        origin,
        allowedOrigin,
      );
    }
    if (existing.product) {
      return jsonResponse({ product: productResponse(existing.product) }, 200, origin, allowedOrigin);
    }

    const userAgent = readEnv("OFF_USER_AGENT")?.trim();
    if (!userAgent) {
      return jsonResponse({ code: "server_configuration", error: "Falta configurar OFF_USER_AGENT con el contacto real de la aplicación." }, 500, origin, allowedOrigin);
    }
    const offQuery = new URLSearchParams({ fields: OFF_FIELDS });
    // Debe coincidir con el contrato nutricional *_100g que consume products.js.
    const offUrl = `https://world.openfoodfacts.org/api/v3.4/product/${encodeURIComponent(code)}.json?${offQuery}`;
    let offResponse: Response;
    try {
      offResponse = await requestFetch(offUrl, {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": userAgent },
        signal: request.signal,
      });
    } catch {
      return jsonResponse({ code: "source_unavailable", error: "No se pudo conectar con Open Food Facts." }, 502, origin, allowedOrigin);
    }
    if (offResponse.status === 404) {
      return jsonResponse({ code: "product_not_found", error: "No se encontró este producto en Open Food Facts." }, 404, origin, allowedOrigin);
    }
    if (!offResponse.ok) {
      const status = offResponse.status === 429 ? 429 : 502;
      return jsonResponse({ code: "source_unavailable", error: "Open Food Facts no está disponible en este momento." }, status, origin, allowedOrigin);
    }

    let payload: unknown;
    try {
      payload = await offResponse.json();
    } catch {
      return jsonResponse({ code: "source_unavailable", error: "Open Food Facts devolvió una respuesta que no se pudo leer." }, 502, origin, allowedOrigin);
    }

    let product: Record<string, unknown>;
    try {
      product = normalizeOpenFoodFacts(payload, code) as Record<string, unknown>;
    } catch (error) {
      const failure = error instanceof ProductDataError
        ? error
        : new ProductDataError("incomplete_product", "Open Food Facts no devolvió una ficha de producto completa.");
      return jsonResponse({ code: failure.code, error: failure.message }, productErrorStatus(failure.code), origin, allowedOrigin);
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload) || !("product" in payload)) {
      return jsonResponse({ code: "incomplete_product", error: "Open Food Facts no devolvió el registro original del producto." }, 422, origin, allowedOrigin);
    }
    const originalProduct = payload.product;
    if (!originalProduct || typeof originalProduct !== "object" || Array.isArray(originalProduct)) {
      return jsonResponse({ code: "incomplete_product", error: "Open Food Facts no devolvió el registro original del producto." }, 422, origin, allowedOrigin);
    }
    const canonicalRecord = originalProduct as Record<string, unknown>;
    const row = {
      ...product,
      registro_off: canonicalRecord,
    };
    let insertResponse: Response;
    try {
      insertResponse = await requestFetch(`${tableUrl}?on_conflict=codigo_barras`, {
        method: "POST",
        headers: {
          ...headers,
          Prefer: "resolution=ignore-duplicates,return=representation",
        },
        body: JSON.stringify(row),
        signal: request.signal,
      });
    } catch {
      return jsonResponse({ code: "storage_unavailable", error: "No se pudo guardar el producto en Supabase." }, 503, origin, allowedOrigin);
    }
    if (!insertResponse.ok) {
      return jsonResponse({ code: "storage_unavailable", error: "No se pudo guardar el producto. Comprueba la migración de Supabase." }, 503, origin, allowedOrigin);
    }

    let inserted: unknown;
    try {
      inserted = await insertResponse.json();
    } catch {
      inserted = null;
    }
    if (Array.isArray(inserted) && inserted.length === 1) {
      const row = inserted[0];
      if (row && typeof row === "object" && !Array.isArray(row)) {
        const storedProduct = row as Record<string, unknown>;
        return jsonResponse({ product: productResponse(storedProduct) }, 201, origin, allowedOrigin);
      }
    }

    // A concurrent request may have won the unique-key insert; return its canonical row without overwriting it.
    const afterInsert = await queryExisting();
    if (afterInsert.available && afterInsert.product) {
      return jsonResponse({ product: productResponse(afterInsert.product) }, 200, origin, allowedOrigin);
    }
    return jsonResponse({ code: "storage_unavailable", error: "El producto no quedó disponible después de guardarlo." }, 503, origin, allowedOrigin);
  };
}

export const handler = createHandler();
if (import.meta.main) Deno.serve(handler);
