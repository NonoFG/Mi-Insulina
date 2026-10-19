const CACHE_PREFIX = "mi-insulina-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v16`;
const SHELL_FILES = [
  "./",
  "./index.html",
  "./main.css",
  "./dosis.js",
  "./catalog.js",
  "./calculos.js",
  "./supabase-config.js",
  "./product-data.js",
  "./products.js",
  "./barcode.js",
  "./scan-product.js",
  "./vendor/zxing-browser.min.js",
  "./site.webmanifest",
  "./favicon-16x16.png",
  "./favicon-32x32.png",
  "./android-chrome-192x192.png",
  "./android-chrome-512x512.png",
  "./apple-touch-icon.png",
];
const CREDENTIAL_HEADERS = ["authorization", "apikey", "x-api-key", "proxy-authorization", "cookie"];

function getShellAssets() {
  const scope = self.registration.scope;
  return SHELL_FILES.map((file) => new URL(file, scope));
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(getShellAssets().map(async (asset) => {
    const request = new Request(asset.href, { method: "GET", credentials: "omit", cache: "reload" });
    const response = await fetch(request);
    if (!response.ok || response.type === "opaque") {
      throw new Error(`No se pudo guardar el recurso de la aplicación: ${asset.pathname}`);
    }
    const responseUrl = response.url ? new URL(response.url) : asset;
    if (responseUrl.origin !== self.location.origin) {
      throw new Error("Un recurso externo no se guarda en la caché de la aplicación.");
    }
    await cache.put(request, response);
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await precacheShell();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const oldCaches = await caches.keys();
    await Promise.all(oldCaches
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

function incluyeCredencialesExplicitas(request) {
  return CREDENTIAL_HEADERS.some((header) => request.headers.has(header));
}

function recursoShell(url, assets) {
  return assets.find((asset) => asset.origin === url.origin && asset.pathname === url.pathname) || null;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || incluyeCredencialesExplicitas(request)) return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const scope = new URL(self.registration.scope);
  if (!requestUrl.pathname.startsWith(scope.pathname)) return;

  const assets = getShellAssets();
  const asset = recursoShell(requestUrl, assets);
  const index = new URL("./index.html", scope);
  const isAppNavigation = request.mode === "navigate"
    && (requestUrl.pathname === scope.pathname || requestUrl.pathname === index.pathname);
  if (!asset && !isAppNavigation) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = asset || index;
    try {
      // El shell se descarga sin credenciales; las consultas Supabase van por otra ruta y nunca se guardan aquí.
      const networkRequest = new Request(requestUrl.href, {
        method: "GET",
        headers: request.headers,
        credentials: "omit",
        cache: "no-cache",
        mode: "same-origin",
      });
      const response = await fetch(networkRequest);
      if (response.ok && response.type !== "opaque") {
        const responseUrl = response.url ? new URL(response.url) : requestUrl;
        if (responseUrl.origin === self.location.origin) {
          const key = new Request(cacheKey.href, { method: "GET", credentials: "omit" });
          await cache.put(key, response.clone());
        }
        return response;
      }
      const saved = await cache.match(cacheKey.href, { ignoreSearch: true });
      return saved || response;
    } catch {
      const saved = await cache.match(cacheKey.href, { ignoreSearch: true });
      return saved || Response.error();
    }
  })());
});
