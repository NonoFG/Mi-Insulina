import { loadCatalog } from "./catalog.js";
import { loadSavedProducts } from "./products.js";
import { initProductScanner } from "./scan-product.js";
import {
  migrarComidaGuardada,
  calcularAlimento,
  calcularComida,
  calcularUGP,
  getDatoNutricional,
  nombreAlimento,
  numeroFinito,
} from "./calculos.js";

const CLAVE_BORRADOR = "borradorComida";
const CLAVE_FAVORITOS = "alimentosFavoritos";
const CLAVE_PLANTILLAS = "comidasGuardadas";
const CLAVE_TEMA = "tema";
const CLAVES_AJUSTES = {
  equivalencia: "gramosPorRacion",
  kcalProteina: "kcalPorGramoProteina",
  kcalGrasa: "kcalPorGramoGrasa",
  kcalUgp: "kcalPorUGP",
};

const $ = (id) => document.getElementById(id);
const body = document.body;
const clone = (value) => JSON.parse(JSON.stringify(value));
const crearId = () => globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function leerJson(clave, valorInicial) {
  try {
    const valor = localStorage.getItem(clave);
    return valor === null ? valorInicial : JSON.parse(valor);
  } catch {
    return valorInicial;
  }
}

function guardarJson(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

function guardarValor(clave, valor) {
  try {
    localStorage.setItem(clave, String(valor));
  } catch {
    // La aplicación sigue calculando durante esta sesión si el almacenamiento no está disponible.
  }
}

function leerPositivo(clave, predeterminado) {
  let valor = null;
  try {
    valor = numeroFinito(localStorage.getItem(clave));
  } catch {
    valor = null;
  }
  return valor !== null && valor > 0 ? valor : predeterminado;
}

function formatear(valor, decimales = 2) {
  if (!Number.isFinite(valor)) return "—";
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: decimales,
    minimumFractionDigits: 0,
  }).format(valor);
}
function formatearInput(valor, decimales = 8) {
  if (!Number.isFinite(valor)) return "";
  return String(Number(valor.toFixed(decimales)));
}


function textoValido(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "object") {
    if (Array.isArray(valor)) return valor.map(textoValido).filter(Boolean).join(", ") || null;
    return textoValido(valor.nombre ?? valor.name ?? valor.title ?? valor.url ?? valor.href);
  }
  return String(valor).trim() || null;
}

function primerTexto(objeto, claves) {
  for (const clave of claves) {
    const valor = textoValido(objeto?.[clave]);
    if (valor) return valor;
  }
  return null;
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function idAlimento(alimento) {
  const id = alimento?.id ?? alimento?.alimento_id ?? alimento?.nombre ?? alimento?.name ?? alimento?.alimento;
  return String(id ?? "");
}

function datosProcedencia(alimento) {
  const fuente = primerTexto(alimento, [
    "fuente", "fuente_nutricional", "fuente_datos", "source", "nutrition_source",
    "referencia_bibliografica", "url_fuente", "source_url",
  ]);
  const fechaCruda = primerTexto(alimento, [
    "fecha_revision", "fecha_de_revision", "fecha_revision_nutricional",
    "reviewed_at", "review_date",
  ]);
  let fecha = fechaCruda;
  if (fechaCruda && /^\d{4}-\d{2}-\d{2}/.test(fechaCruda)) {
    const instante = new Date(fechaCruda);
    if (Number.isFinite(instante.getTime())) {
      fecha = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" }).format(instante);
    }
  }
  const estado = primerTexto(alimento, [
    "estado_crudo_cocinado", "crudo_cocido", "raw_cooked", "cooked_state",
    "preparation_state", "estado_coccion", "preparacion",
  ]);
  const estadoEnNombre = nombreAlimento(alimento)
    .match(/\b(crud[oa]s?|hervid[oa]s?|cocid[oa]s?|cocinad[oa]s?)\b/i)?.[0];
  return {
    fuente: fuente || "No indicada en el registro.",
    fecha: fecha || "No disponible en el registro.",
    estado: estado || (estadoEnNombre ? `${estadoEnNombre} (según el nombre del alimento).` : "No indicado en el registro."),
  };
}

function unidadCantidad(alimento) {
  return alimento?.unidad_cantidad === "ml" ? "ml" : "g";
}

function textoNutricional(alimento) {
  const hc100 = getDatoNutricional(alimento, "hidratos");
  const grasa100 = getDatoNutricional(alimento, "grasas");
  const proteina100 = getDatoNutricional(alimento, "proteinas");
  const gramosRacion = numeroFinito(alimento?.gramos_1_racion_hc ?? alimento?.gramos1RacionHC ?? alimento?.gramos_1_racion);
  const unidad = unidadCantidad(alimento);
  const partes = [
    hc100 === null ? `HC/100 ${unidad}: desconocidos` : `HC/100 ${unidad}: ${formatear(hc100)} g`,
    grasa100 === null ? `grasas/100 ${unidad}: desconocidas` : `grasas/100 ${unidad}: ${formatear(grasa100)} g`,
    proteina100 === null ? `proteínas/100 ${unidad}: desconocidas` : `proteínas/100 ${unidad}: ${formatear(proteina100)} g`,
  ];
  if (hc100 === null && Number.isFinite(gramosRacion) && gramosRacion > 0) {
    partes.push(`equivalencia original: ${formatear(gramosRacion)} g de alimento por ración histórica de 10 g HC`);
  } else if (typeof (alimento?.gramos_1_racion_hc ?? alimento?.gramos1RacionHC ?? alimento?.gramos_1_racion) === "string") {
    const dato = String(alimento.gramos_1_racion_hc ?? alimento.gramos1RacionHC ?? alimento.gramos_1_racion).trim();
    if (dato) partes.push(`dato del catálogo: ${dato}`);
  }
  const procedencia = datosProcedencia(alimento);
  return `${partes.join(" · ")}. Fuente: ${procedencia.fuente} Fecha de revisión: ${procedencia.fecha} Estado crudo/cocinado: ${procedencia.estado}`;
}

function leerEntradasManuales(valores) {
  const entradas = [];
  if (!Array.isArray(valores)) return entradas;
  for (const entrada of valores) {
    const gramos = numeroFinito(entrada?.gramos);
    if (gramos !== null && gramos >= 0) {
      entradas.push({ id: String(entrada.id || crearId()), gramos });
    }
  }
  return entradas;
}

function leerBorrador() {
  const anterior = leerJson(CLAVE_BORRADOR, {});
  const borrador = migrarComidaGuardada(anterior);
  if (borrador !== anterior) guardarJson(CLAVE_BORRADOR, borrador);
  const alimentos = Array.isArray(borrador?.alimentos)
    ? borrador.alimentos.filter((entrada) => entrada && typeof entrada === "object" && entrada.alimento)
      .map((entrada) => ({
        id: String(entrada.id || crearId()),
        alimento: entrada.alimento,
        gramos: numeroFinito(entrada.gramos),
      }))
    : [];
  const extraLeido = numeroFinito(borrador?.hidratosExtra);
  return {
    alimentos,
    grasasManuales: leerEntradasManuales(borrador?.grasasManuales),
    proteinasManuales: leerEntradasManuales(borrador?.proteinasManuales),
    hidratosExtra: extraLeido !== null && extraLeido >= 0 ? extraLeido : 0,
    extraVacio: borrador?.extraVacio !== false,
  };
}
const estadoComida = leerBorrador();
const equivalenciaInicial = leerPositivo(CLAVES_AJUSTES.equivalencia, 10);
const ajustes = {
  equivalencia: equivalenciaInicial,
  kcalProteina: leerPositivo(CLAVES_AJUSTES.kcalProteina, 4),
  kcalGrasa: leerPositivo(CLAVES_AJUSTES.kcalGrasa, 9),
  kcalUgp: leerPositivo(CLAVES_AJUSTES.kcalUgp, 150),
};
let catalogo = [];
let productosGuardados = [];
let escanerProductos = null;
let vistaRenderizada = null;
let catalogoCargando = false;
let alimentoActual = null;
let resultadosActuales = [];
let opcionActiva = -1;
let borradorExtraValido = true;

const inputRacionesExtra = $("raciones");
const busquedaAlimento = $("alimento-tabla-hc");
const inputGramosAlimento = $("gramos-tabla-hc");
const listaOpciones = $("alimentos-tabla-hc-list");
const listaComida = $("alimentos-tabla-hc-seleccionados");
const infoAlimento = $("info-alimento");
const estadoCatalogo = $("estado-catalogo");
const botonFavoritoActual = $("favorito-actual");
const listaFavoritos = $("lista-favoritos");
const desgloseComida = $("desglose-comida");
const totalComida = $("total-comida");
const resumenMacros = $("resumen-macros");

function guardarBorrador() {
  const guardado = guardarJson(CLAVE_BORRADOR, {
    alimentos: estadoComida.alimentos,
    grasasManuales: estadoComida.grasasManuales,
    proteinasManuales: estadoComida.proteinasManuales,
    hidratosExtra: estadoComida.hidratosExtra,
    extraVacio: estadoComida.extraVacio,
  });
  $("estado-borrador").textContent = guardado
    ? "Borrador de comida guardado en este dispositivo."
    : "No se pudo guardar el borrador en este dispositivo.";
}

function setError(input, elemento, mensaje) {
  elemento.textContent = mensaje;
  input.classList.toggle("error", Boolean(mensaje));
  if (mensaje) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

function borrarError(input, elemento) {
  setError(input, elemento, "");
}

function leerCantidadExacta(prefijo) {
  const input = $(`${prefijo}-exactos`);
  const cantidad = numeroFinito(input.value);
  const invalida = input.validity.badInput || cantidad === null || cantidad < 0;
  setError(input, $(`error-${prefijo}-exactos`), invalida
    ? "Indica los gramos totales con un número no negativo; 0 g es válido." : "");
  if (invalida) {
    input.focus();
    return null;
  }
  return cantidad;
}


function actualizarEstadoCatalogo(estado) {
  const actual = estado || {};
  estadoCatalogo.hidden = false;
  if (actual.state === "loading") {
    catalogoCargando = true;
    estadoCatalogo.textContent = "Cargando o actualizando el catálogo…";
    return;
  }
  catalogoCargando = false;
  if (actual.state === "fresh") {
    estadoCatalogo.textContent = actual.cacheSaved === false
      ? textoValido(actual.message) || "No se pudo guardar una copia del catálogo." : "";
    estadoCatalogo.hidden = !estadoCatalogo.textContent;
  } else if (actual.state === "cached") {
    estadoCatalogo.textContent = `Usando el catálogo guardado en este dispositivo.${actual.message ? ` ${textoValido(actual.message)}` : ""}`;
  } else if (actual.state === "stale") {
    estadoCatalogo.textContent = `El catálogo guardado podría estar desactualizado.${actual.message ? ` ${textoValido(actual.message)}` : ""}`;
  } else if (actual.state === "error") {
    const mensaje = textoValido(actual.message) || "Comprueba la conexión e inténtalo de nuevo.";
    estadoCatalogo.textContent = `No se pudo actualizar el catálogo. ${mensaje} La comida actual se conserva.`;
  }
}

async function cargarCatalogo() {
  if (catalogoCargando) return;
  actualizarEstadoCatalogo({ state: "loading" });
  try {
    const respuesta = await loadCatalog({ onStatus: actualizarEstadoCatalogo });
    catalogo = Array.isArray(respuesta?.foods) ? respuesta.foods : [];
    const estado = respuesta?.stale ? "stale" : respuesta?.cached ? "cached" : "fresh";
    actualizarEstadoCatalogo({
      state: estado,
      message: respuesta?.message,
      cacheSaved: respuesta?.cacheSaved,
    });
    renderOpcionesAlimento();
    renderFavoritos();
  } catch (error) {
    catalogoCargando = false;
    actualizarEstadoCatalogo({
      state: "error",
      message: error instanceof Error ? error.message : "Error de conexión.",
    });
  }
}

async function cargarProductosGuardados() {
  const estado = $("estado-productos-guardados");
  estado.textContent = "Consultando productos guardados…";
  try {
    productosGuardados = await loadSavedProducts();
    estado.textContent = `${productosGuardados.length} productos escaneados guardados en la BD, disponibles en la búsqueda de alimentos.`;
    renderOpcionesAlimento();
  } catch (error) {
    estado.textContent = `${error instanceof Error ? error.message : "No se pudieron consultar los productos guardados."} El catálogo habitual se conserva.`;
  }
}

function etiquetaAlimento(alimento) {
  const nombre = nombreAlimento(alimento);
  const categoria = textoValido(alimento?.categorias?.nombre ?? alimento?.categoria?.nombre ?? alimento?.seccion);
  return categoria ? `${nombre} (${categoria})` : nombre;
}

function buscarAlimentos() {
  const consulta = normalizarTexto(busquedaAlimento.value);
  if (!consulta) return [];
  return [...catalogo, ...productosGuardados].map((alimento) => {
    const nombre = normalizarTexto(nombreAlimento(alimento));
    let relevancia = -1;
    if (nombre.startsWith(consulta)) relevancia = 0;
    else if (nombre.split(/\s+/).some((palabra) => palabra.startsWith(consulta))) relevancia = 1;
    else if (nombre.includes(consulta)) relevancia = 2;
    return { alimento, relevancia };
  }).filter((resultado) => resultado.relevancia >= 0)
    .sort((a, b) => a.relevancia - b.relevancia || etiquetaAlimento(a.alimento).localeCompare(etiquetaAlimento(b.alimento), "es"))
    .slice(0, 8)
    .map((resultado) => resultado.alimento);
}

function cerrarOpciones() {
  listaOpciones.replaceChildren();
  listaOpciones.classList.remove("visible");
  busquedaAlimento.setAttribute("aria-expanded", "false");
  busquedaAlimento.removeAttribute("aria-activedescendant");
  resultadosActuales = [];
  opcionActiva = -1;
}

function moverOpcionActiva(indice) {
  if (!resultadosActuales.length) return;
  opcionActiva = (indice + resultadosActuales.length) % resultadosActuales.length;
  const opciones = listaOpciones.querySelectorAll('[role="option"]');
  opciones.forEach((opcion, posicion) => {
    const activa = posicion === opcionActiva;
    opcion.setAttribute("aria-selected", String(activa));
    opcion.classList.toggle("activa", activa);
  });
  const opcion = opciones[opcionActiva];
  if (opcion) {
    busquedaAlimento.setAttribute("aria-activedescendant", opcion.id);
    opcion.scrollIntoView?.({ block: "nearest" });
  }
}

function renderOpcionesAlimento() {
  const resultados = buscarAlimentos();
  listaOpciones.replaceChildren();
  resultadosActuales = resultados;
  opcionActiva = -1;
  if (!resultados.length) {
    listaOpciones.classList.remove("visible");
    busquedaAlimento.setAttribute("aria-expanded", "false");
    busquedaAlimento.removeAttribute("aria-activedescendant");
    return;
  }
  resultados.forEach((alimento, indice) => {
    const opcion = document.createElement("button");
    const nombre = document.createElement("span");
    const informacion = document.createElement("small");
    opcion.type = "button";
    opcion.id = `opcion-alimento-${indice}`;
    opcion.className = "opcion-tabla-hc";
    opcion.setAttribute("role", "option");
    opcion.setAttribute("aria-selected", "false");
    opcion.tabIndex = -1;
    nombre.textContent = etiquetaAlimento(alimento);
    informacion.textContent = textoNutricional(alimento);
    opcion.addEventListener("pointerdown", (evento) => evento.preventDefault());
    opcion.addEventListener("click", () => seleccionarAlimento(alimento));
    opcion.append(nombre, informacion);
    listaOpciones.append(opcion);
  });
  listaOpciones.classList.add("visible");
  busquedaAlimento.setAttribute("aria-expanded", "true");
}

function actualizarVista() {
  const vistaActual = location.hash === "#escaner" || location.hash === "#manual"
    ? location.hash : "#comida";
  if (vistaRenderizada === "#escaner" && vistaActual !== "#escaner") escanerProductos?.stop();
  vistaRenderizada = vistaActual;
  $("comida").hidden = vistaActual !== "#comida";
  $("manual").hidden = vistaActual !== "#manual";
  $("escaner").hidden = vistaActual !== "#escaner";
  document.querySelectorAll(".navegacion-app a").forEach((enlace) => {
    if (enlace.hash === vistaActual) enlace.setAttribute("aria-current", "page");
    else enlace.removeAttribute("aria-current");
  });
}

function cambiarVista(vista) {
  const hash = `#${vista}`;
  if (location.hash !== hash) history.pushState(null, "", hash);
  actualizarVista();
}

function seleccionarAlimento(alimento) {
  if (alimento.codigo_barras) {
    alimentoActual = null;
    busquedaAlimento.value = etiquetaAlimento(alimento);
    inputGramosAlimento.value = "";
    botonFavoritoActual.disabled = true;
    infoAlimento.textContent = "Revisa el producto escaneado y acepta su cantidad antes de añadirlo.";
    cerrarOpciones();
    cambiarVista("escaner");
    escanerProductos.reviewProduct(alimento, {
      saved: productosGuardados.some((producto) => producto.codigo_barras === alimento.codigo_barras),
    });
    return;
  }
  alimentoActual = alimento;
  busquedaAlimento.value = etiquetaAlimento(alimento);
  infoAlimento.textContent = `${etiquetaAlimento(alimento)}. ${textoNutricional(alimento)}`;
  const favorito = leerJson(CLAVE_FAVORITOS, []);
  const esFavorito = Array.isArray(favorito) && favorito.some((item) => item.id === idAlimento(alimento));
  botonFavoritoActual.disabled = false;
  botonFavoritoActual.textContent = esFavorito ? "Quitar de favoritos" : "Añadir a favoritos";
  cerrarOpciones();
  inputGramosAlimento.focus();
}

function alimentoExacto(consulta) {
  const texto = normalizarTexto(consulta);
  if (!texto) return null;
  const alimentos = [...catalogo, ...productosGuardados];
  return alimentos.find((alimento) => normalizarTexto(etiquetaAlimento(alimento)) === texto)
    || alimentos.find((alimento) => normalizarTexto(nombreAlimento(alimento)) === texto)
    || null;
}

function toggleFavorito(alimento) {
  const favoritos = leerJson(CLAVE_FAVORITOS, []);
  const lista = Array.isArray(favoritos) ? favoritos : [];
  const id = idAlimento(alimento);
  const indice = lista.findIndex((item) => item.id === id);
  if (indice >= 0) lista.splice(indice, 1);
  else lista.push({ id, alimento: clone(alimento) });
  const guardado = guardarJson(CLAVE_FAVORITOS, lista);
  $("estado-favoritos").textContent = guardado
    ? "Favoritos guardados en este dispositivo."
    : "No se pudieron guardar los favoritos en este dispositivo.";
  renderFavoritos();
  if (alimentoActual && idAlimento(alimentoActual) === id) {
    botonFavoritoActual.textContent = indice >= 0 ? "Añadir a favoritos" : "Quitar de favoritos";
  }
}

function renderFavoritos() {
  const valor = leerJson(CLAVE_FAVORITOS, []);
  const favoritos = Array.isArray(valor) ? valor : [];
  listaFavoritos.replaceChildren();
  if (!favoritos.length) {
    const vacio = document.createElement("li");
    vacio.textContent = "Todavía no hay alimentos favoritos.";
    vacio.className = "lista-vacia";
    listaFavoritos.append(vacio);
    return;
  }
  favoritos.forEach((favorito) => {
    if (!favorito?.alimento) return;
    const item = document.createElement("li");
    const nombre = document.createElement("span");
    const usar = document.createElement("button");
    const quitar = document.createElement("button");
    nombre.textContent = etiquetaAlimento(favorito.alimento);
    usar.type = "button";
    usar.textContent = "Elegir";
    usar.addEventListener("click", () => seleccionarAlimento(favorito.alimento));
    quitar.type = "button";
    quitar.className = "boton-secundario";
    quitar.textContent = "Quitar";
    quitar.setAttribute("aria-label", `Quitar ${nombreAlimento(favorito.alimento)} de favoritos`);
    quitar.addEventListener("click", () => toggleFavorito(favorito.alimento));
    item.append(nombre, usar, quitar);
    listaFavoritos.append(item);
  });
}

function actualizarDetalleFila(entrada, fila) {
  const texto = fila.querySelector(".detalle-porcion");
  const error = fila.querySelector(".error-cantidad-fila");
  const input = fila.querySelector(".cantidad-alimento-editable");
  const valores = fila.querySelectorAll(".valor-nutriente");
  valores.forEach((elemento) => { elemento.textContent = "—"; });
  const cantidad = numeroFinito(entrada.gramos);
  if (cantidad === null || cantidad < 0) {
    texto.textContent = "Cantidad sin calcular.";
    setError(input, error, cantidad === null
      ? "Indica una cantidad válida."
      : "La cantidad no puede ser negativa.");
    return null;
  }
  borrarError(input, error);
  try {
    const calculo = calcularAlimento(entrada.alimento, cantidad, ajustes.equivalencia);
    valores.forEach((elemento) => {
      const nutriente = elemento.dataset.nutriente;
      const valor = calculo[nutriente];
      elemento.textContent = valor === null ? "Sin dato"
        : `${formatear(valor)}${nutriente === "raciones" ? "" : " g"}`;
    });
    if (calculo.hidratos === null) {
      texto.textContent = "Hidratos desconocidos; no se pueden calcular las raciones.";
      error.textContent = "No hay hidratos conocidos ni equivalencia para calcular esta cantidad.";
      return null;
    }
    const unidad = entrada.alimento.entrada_hc_directa ? "g HC directos" : unidadCantidad(entrada.alimento);
    texto.textContent = `Calculado para ${formatear(cantidad)} ${unidad}. 1 ración = ${formatear(ajustes.equivalencia)} g HC.`;
    return calculo;
  } catch (errorCalculo) {
    texto.textContent = "Cantidad sin calcular.";
    error.textContent = errorCalculo instanceof Error ? errorCalculo.message : "No se pudo calcular esta cantidad.";
    return null;
  }
}

function renderListaComida() {
  listaComida.replaceChildren();
  if (!estadoComida.alimentos.length) {
    const vacio = document.createElement("li");
    vacio.textContent = "Aún no se han añadido alimentos.";
    vacio.className = "lista-vacia";
    listaComida.append(vacio);
    return;
  }
  estadoComida.alimentos.forEach((entrada) => {
    const fila = document.createElement("li");
    fila.className = "alimento-comida";
    fila.id = `alimento-${entrada.id}`;
    fila.tabIndex = -1;
    const encabezado = document.createElement("div");
    encabezado.className = "alimento-comida-encabezado";
    const nombre = document.createElement("strong");
    nombre.textContent = nombreAlimento(entrada.alimento);
    const favorito = document.createElement("button");
    favorito.type = "button";
    favorito.className = "boton-secundario";
    const favoritos = leerJson(CLAVE_FAVORITOS, []);
    const yaEsFavorito = Array.isArray(favoritos) && favoritos.some((item) => item.id === idAlimento(entrada.alimento));
    favorito.textContent = yaEsFavorito ? "Quitar favorito" : "Guardar favorito";
    favorito.addEventListener("click", () => {
      toggleFavorito(entrada.alimento);
      renderListaComida();
    });
    encabezado.append(nombre);

    const etiqueta = document.createElement("label");
    const input = document.createElement("input");
    etiqueta.textContent = entrada.alimento.entrada_hc_directa ? "Cantidad de HC (g)" : `Cantidad consumida (${unidadCantidad(entrada.alimento)})`;
    input.type = "number";
    input.min = "0";
    input.step = "0.1";
    input.className = "cantidad-alimento-editable";
    input.value = entrada.gramos === null ? "" : String(entrada.gramos);
    input.setAttribute("aria-label", `Cantidad de ${nombreAlimento(entrada.alimento)} en ${unidadCantidad(entrada.alimento)}`);
    etiqueta.append(input);
    const nutrientes = document.createElement("dl");
    nutrientes.className = "nutrientes-porcion";
    [
      ["hidratos", "Hidratos"],
      ["raciones", "Raciones"],
      ["grasas", "Grasas"],
      ["proteinas", "Proteínas"],
    ].forEach(([clave, titulo]) => {
      const grupo = document.createElement("div");
      const etiquetaNutriente = document.createElement("dt");
      const valor = document.createElement("dd");
      etiquetaNutriente.textContent = titulo;
      valor.className = "valor-nutriente";
      valor.dataset.nutriente = clave;
      grupo.append(etiquetaNutriente, valor);
      nutrientes.append(grupo);
    });
    const detalle = document.createElement("p");
    detalle.className = "detalle-porcion";
    const error = document.createElement("small");
    error.className = "error-text error-cantidad-fila";
    error.id = `error-cantidad-${entrada.id}`;
    input.setAttribute("aria-describedby", error.id);
    const datos = document.createElement("details");
    datos.className = "datos-alimento";
    const tituloDatos = document.createElement("summary");
    tituloDatos.textContent = "Composición y procedencia";
    const composicion = document.createElement("p");
    composicion.textContent = entrada.alimento.entrada_hc_directa
      ? "Entrada directa de gramos HC; no requiere el peso del alimento. Valor introducido manualmente por el usuario; no verificado."
      : textoNutricional(entrada.alimento);
    datos.append(tituloDatos, composicion);
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "boton-secundario";
    quitar.textContent = "Quitar alimento";
    quitar.setAttribute("aria-label", `Quitar ${nombreAlimento(entrada.alimento)} de la comida`);
    quitar.addEventListener("click", () => {
      estadoComida.alimentos = estadoComida.alimentos.filter((item) => item.id !== entrada.id);
      guardarBorrador();
      renderListaComida();
      recalcularComida();
    });
    input.addEventListener("input", () => {
      const cantidad = numeroFinito(input.value);
      entrada.gramos = input.validity.badInput ? null : cantidad;
      if (entrada.gramos === null || entrada.gramos < 0) {
        if (entrada.gramos !== null && entrada.gramos < 0) error.textContent = "La cantidad no puede ser negativa.";
        else error.textContent = "Indica una cantidad válida de gramos.";
      } else {
        error.textContent = "";
        guardarBorrador();
      }
      actualizarDetalleFila(entrada, fila);
      recalcularComida();
    });
    const acciones = document.createElement("div");
    acciones.className = "acciones-alimento";
    acciones.append(favorito, quitar);
    fila.append(encabezado, etiqueta, nutrientes, detalle, error, datos, acciones);
    actualizarDetalleFila(entrada, fila);
    listaComida.append(fila);
  });
}

function setLineaResumen(texto) {
  const linea = document.createElement("li");
  linea.textContent = texto;
  desgloseComida.append(linea);
}

function renderResumenMacros(calculo) {
  const alimentos = calculo.alimentos;
  const totalGrasaConocida = acumuladorGrasas.getTotal()
    + alimentos.reduce((total, entrada) => total + (entrada.grasas ?? 0), 0);
  const totalProteinaConocida = acumuladorProteinas.getTotal()
    + alimentos.reduce((total, entrada) => total + (entrada.proteinas ?? 0), 0);
  const desconocidasGrasa = alimentos.filter((entrada) => entrada.grasas === null).length;
  const desconocidasProteina = alimentos.filter((entrada) => entrada.proteinas === null).length;
  const mensajeMacro = (nombre, total, desconocidas) => desconocidas
    ? `${nombre}: ${formatear(total)} g conocidos; dato no disponible en ${desconocidas} entrada${desconocidas === 1 ? "" : "s"}.`
    : `${nombre}: ${formatear(total)} g.`;
  resumenMacros.textContent = alimentos.length
    || estadoComida.grasasManuales.length || estadoComida.proteinasManuales.length
    ? `${mensajeMacro("Grasas", totalGrasaConocida, desconocidasGrasa)} ${mensajeMacro("Proteínas", totalProteinaConocida, desconocidasProteina)}`
    : "Grasas y proteínas: 0 g; no hay alimentos añadidos.";
}

function sincronizarEntradaExtra() {
  if (!borradorExtraValido) return;
  inputRacionesExtra.value = estadoComida.extraVacio && estadoComida.hidratosExtra === 0
    ? "" : formatearInput(estadoComida.hidratosExtra / ajustes.equivalencia);
}


function recalcularComida() {
  recalcularUgp();
  const invalidos = [];
  const datosAlimentos = [];
  estadoComida.alimentos.forEach((entrada) => {
    const cantidad = numeroFinito(entrada.gramos);
    if (cantidad === null || cantidad < 0) {
      invalidos.push(nombreAlimento(entrada.alimento));
      return;
    }
    try {
      const calculo = calcularAlimento(entrada.alimento, cantidad, ajustes.equivalencia);
      if (calculo.hidratos === null) invalidos.push(nombreAlimento(entrada.alimento));
      else datosAlimentos.push({ id: entrada.id, alimento: entrada.alimento, gramos: cantidad });
    } catch {
      invalidos.push(nombreAlimento(entrada.alimento));
    }
  });
  desgloseComida.replaceChildren();
  datosAlimentos.forEach((entrada) => {
    const calculo = calcularAlimento(entrada.alimento, entrada.gramos, ajustes.equivalencia);
    const unidad = entrada.alimento.entrada_hc_directa ? "g HC directos" : `${unidadCantidad(entrada.alimento)} de alimento`;
    setLineaResumen(`${calculo.nombre}: ${formatear(calculo.gramos)} ${unidad} · ${formatear(calculo.hidratos)} g HC · ${formatear(calculo.raciones)} raciones`);
  });
  if (estadoComida.grasasManuales.length) {
    setLineaResumen(`Grasas añadidas manualmente: ${formatear(acumuladorGrasas.getTotal())} g.`);
  }
  if (estadoComida.proteinasManuales.length) {
    setLineaResumen(`Proteínas añadidas manualmente: ${formatear(acumuladorProteinas.getTotal())} g.`);
  }
  const errorRaciones = $("error-raciones");
  if (!borradorExtraValido) invalidos.push("raciones extra");
  if (estadoComida.extraVacio) setLineaResumen("Raciones extra: vacío = 0 g HC.");
  else setLineaResumen(`Raciones extra: ${formatear(estadoComida.hidratosExtra / ajustes.equivalencia, 4)} raciones · ${formatear(estadoComida.hidratosExtra)} g HC conservados.`);

  if (invalidos.length) {
    totalComida.textContent = `Total no disponible: corrige ${invalidos.join(", ")}.`;
    resumenMacros.textContent = "No se muestran totales parciales como si fueran un total completo.";
    return null;
  }
  try {
    const calculo = calcularComida({
      alimentos: datosAlimentos,
      hidratosExtra: estadoComida.hidratosExtra,
      gramosPorRacion: ajustes.equivalencia,
    });
    totalComida.textContent = `Total: ${formatear(calculo.total.hidratos)} g HC · ${formatear(calculo.total.raciones)} raciones (${formatear(ajustes.equivalencia)} g HC por ración)`;
    renderResumenMacros(calculo);
    borrarError(inputRacionesExtra, errorRaciones);
    return calculo;
  } catch (error) {
    totalComida.textContent = `Total no disponible: ${error instanceof Error ? error.message : "hay datos que corregir"}.`;
    resumenMacros.textContent = "No se muestran totales parciales como si fueran un total completo.";
    return null;
  }
}

function puedeCalcularAlimento(alimento, gramos) {
  try {
    return calcularAlimento(alimento, gramos, ajustes.equivalencia).hidratos !== null;
  } catch {
    return false;
  }
}

function anadirAlimento() {
  const errorGramos = $("error-gramos-alimento");
  const gramos = numeroFinito(inputGramosAlimento.value);
  if (!alimentoActual) {
    const exacto = alimentoExacto(busquedaAlimento.value);
    if (exacto) seleccionarAlimento(exacto);
    else {
      infoAlimento.textContent = catalogo.length
        ? "Elige un alimento de los resultados de búsqueda."
        : "El catálogo aún no está disponible. Puedes reintentar la carga.";
      busquedaAlimento.focus();
      return;
    }
    if (exacto.codigo_barras) return;
  }
  if (inputGramosAlimento.validity.badInput || gramos === null || gramos < 0) {
    setError(inputGramosAlimento, errorGramos, gramos !== null && gramos < 0
      ? "Los gramos no pueden ser negativos."
      : "Indica una cantidad válida de gramos; 0 g se interpreta como cero.");
    inputGramosAlimento.focus();
    return;
  }
  if (!puedeCalcularAlimento(alimentoActual, gramos)) {
    infoAlimento.textContent = "No se puede añadir: los hidratos son desconocidos y el catálogo no contiene una equivalencia para calcularlos.";
    return;
  }
  borrarError(inputGramosAlimento, errorGramos);
  estadoComida.alimentos.push({
    id: crearId(),
    alimento: clone(alimentoActual),
    gramos,
  });
  guardarBorrador();
  renderListaComida();
  recalcularComida();
  busquedaAlimento.value = "";
  inputGramosAlimento.value = "";
  alimentoActual = null;
  botonFavoritoActual.disabled = true;
  botonFavoritoActual.textContent = "Añadir a favoritos";
  infoAlimento.textContent = "Alimento añadido a la comida. Elige otro para ver sus datos.";
  cerrarOpciones();
  busquedaAlimento.focus();
}

function agregarHidratosManuales(cantidad, por100 = null) {
  const directo = por100 === null;
  estadoComida.alimentos.push({
    id: crearId(),
    alimento: {
      id: crearId(),
      nombre: directo ? "Hidratos manuales (gramos HC)" : "Alimento con hidratos introducidos manualmente",
      carbs_100g: directo ? 100 : por100,
      fuente: "Valor introducido manualmente por el usuario; no verificado.",
      entrada_hc_directa: directo,
    },
    gramos: cantidad,
  });
  guardarBorrador();
  renderListaComida();
  recalcularComida();
  const hidratosAnadidos = directo ? cantidad : cantidad * por100 / 100;
  $("estado-hc-manual").textContent = `Añadidos ${formatear(hidratosAnadidos)} g HC a la comida. El resumen global al final del apartado ya está actualizado.`;
}

function anadirHidratosManuales() {
  const inputPor100 = $("hc-100g");
  const inputCantidad = $("hc-gramos");
  const por100 = numeroFinito(inputPor100.value);
  const cantidad = numeroFinito(inputCantidad.value);
  const por100Invalido = inputPor100.validity.badInput || por100 === null || por100 < 0;
  const cantidadInvalida = inputCantidad.validity.badInput || cantidad === null || cantidad < 0;
  setError(inputPor100, $("error-hc-100g"), por100Invalido ? "Indica un valor de hidratos por 100 g finito y no negativo." : "");
  setError(inputCantidad, $("error-hc-gramos"), cantidadInvalida ? "Indica una cantidad finita no negativa; 0 aporta cero." : "");
  if (por100Invalido || cantidadInvalida) return;
  agregarHidratosManuales(cantidad, por100);
  inputPor100.value = "";
  inputCantidad.value = "";
}

$("hc-anadir").addEventListener("click", anadirHidratosManuales);
$("hc-gramos").addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    evento.preventDefault();
    anadirHidratosManuales();
  }
});

$("form-hc-exactos").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const cantidad = leerCantidadExacta("hc");
  if (cantidad === null) return;
  agregarHidratosManuales(cantidad);
  $("hc-exactos").value = "";
  $("hc-exactos").focus();
});

function leerExtra() {
  const error = $("error-raciones");
  const valor = numeroFinito(inputRacionesExtra.value);
  if (inputRacionesExtra.validity.badInput || (inputRacionesExtra.value !== "" && valor === null) || (valor !== null && valor < 0)) {
    borradorExtraValido = false;
    setError(inputRacionesExtra, error, valor !== null && valor < 0
      ? "Las raciones extra no pueden ser negativas."
      : "Indica un número finito de raciones o deja el campo vacío.");
    recalcularComida();
    return;
  }
  borradorExtraValido = true;
  borrarError(inputRacionesExtra, error);
  estadoComida.extraVacio = inputRacionesExtra.value === "";
  estadoComida.hidratosExtra = valor === null ? 0 : valor * ajustes.equivalencia;
  guardarBorrador();
  recalcularComida();
}

function actualizarTema(tema) {
  const valor = ["automatico", "claro", "oscuro"].includes(tema) ? tema : "automatico";
  body.dataset.tema = valor;
  document.querySelectorAll('input[name="tema"]').forEach((radio) => {
    radio.checked = radio.value === valor;
  });
  guardarValor(CLAVE_TEMA, valor);
}

function inicializarTema() {
  let guardado = "automatico";
  try {
    guardado = localStorage.getItem(CLAVE_TEMA) || "automatico";
  } catch {
    // El modo automático es el valor inicial si no se puede consultar el almacenamiento.
  }
  actualizarTema(guardado);
  document.querySelectorAll('input[name="tema"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) actualizarTema(radio.value);
    });
  });
}

const botonAjustes = $("btnAjustes");
const modalAjustes = $("modalAjustes");
const dialogoAjustes = modalAjustes.querySelector('[role="dialog"]');
const inputEquivalencia = $("gramosPorRacionInput");
const inputKcalProteina = $("kcalProteinaInput");
const inputKcalGrasa = $("kcalGrasaInput");
const inputKcalUgp = $("kcalPorUgpInput");
const botonGuardarAjustes = $("guardarAjustes");
const botonCerrarAjustes = $("cerrarAjustes");
let focoAnteriorModal = null;

function abrirAjustes() {
  focoAnteriorModal = document.activeElement;
  inputEquivalencia.value = String(ajustes.equivalencia);
  inputKcalProteina.value = String(ajustes.kcalProteina);
  inputKcalGrasa.value = String(ajustes.kcalGrasa);
  inputKcalUgp.value = String(ajustes.kcalUgp);
  [
    [inputEquivalencia, $("error-equivalencia")],
    [inputKcalProteina, $("error-kcal-proteina")],
    [inputKcalGrasa, $("error-kcal-grasa")],
    [inputKcalUgp, $("error-kcal-ugp")],
  ].forEach(([input, error]) => borrarError(input, error));
  modalAjustes.hidden = false;
  inputEquivalencia.focus();
}

function cerrarAjustes() {
  modalAjustes.hidden = true;
  if (focoAnteriorModal instanceof HTMLElement) focoAnteriorModal.focus();
}

function validarAjustes() {
  const filas = [
    [inputEquivalencia, $("error-equivalencia"), "Indica una equivalencia mayor que cero."],
    [inputKcalProteina, $("error-kcal-proteina"), "Indica un valor mayor que cero."],
    [inputKcalGrasa, $("error-kcal-grasa"), "Indica un valor mayor que cero."],
    [inputKcalUgp, $("error-kcal-ugp"), "Indica un valor mayor que cero."],
  ];
  const valores = filas.map(([input, error, mensaje]) => {
    const valor = numeroFinito(input.value);
    const invalido = input.validity.badInput || valor === null || valor <= 0;
    setError(input, error, invalido ? mensaje : "");
    return invalido ? null : valor;
  });
  if (valores.some((valor) => valor === null)) return;
  [ajustes.equivalencia, ajustes.kcalProteina, ajustes.kcalGrasa, ajustes.kcalUgp] = valores;
  guardarValor(CLAVES_AJUSTES.equivalencia, ajustes.equivalencia);
  guardarValor(CLAVES_AJUSTES.kcalProteina, ajustes.kcalProteina);
  guardarValor(CLAVES_AJUSTES.kcalGrasa, ajustes.kcalGrasa);
  guardarValor(CLAVES_AJUSTES.kcalUgp, ajustes.kcalUgp);
  cerrarAjustes();
  sincronizarEntradaExtra();
  renderListaComida();

  recalcularComida();
  escanerProductos.updatePreview();
}

function elementosEnModal() {
  return [...dialogoAjustes.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((elemento) => !elemento.hidden && elemento.getClientRects().length > 0);
}

botonAjustes.addEventListener("click", abrirAjustes);
botonCerrarAjustes.addEventListener("click", cerrarAjustes);
botonGuardarAjustes.addEventListener("click", validarAjustes);
modalAjustes.addEventListener("click", (evento) => {
  if (evento.target === modalAjustes) cerrarAjustes();
});
modalAjustes.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") {
    evento.preventDefault();
    cerrarAjustes();
    return;
  }
  if (evento.key !== "Tab") return;
  const elementos = elementosEnModal();
  if (!elementos.length) {
    evento.preventDefault();
    dialogoAjustes.focus();
    return;
  }
  const primero = elementos[0];
  const ultimo = elementos[elementos.length - 1];
  if (evento.shiftKey && document.activeElement === primero) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault();
    primero.focus();
  }
});

busquedaAlimento.addEventListener("input", () => {
  alimentoActual = null;
  botonFavoritoActual.disabled = true;
  botonFavoritoActual.textContent = "Añadir a favoritos";
  infoAlimento.textContent = "Elige un alimento para consultar sus datos nutricionales y su procedencia.";
  renderOpcionesAlimento();
});
busquedaAlimento.addEventListener("focus", renderOpcionesAlimento);
busquedaAlimento.addEventListener("blur", () => {
  window.setTimeout(cerrarOpciones, 120);
});
busquedaAlimento.addEventListener("keydown", (evento) => {
  if (evento.key === "ArrowDown" && resultadosActuales.length) {
    evento.preventDefault();
    moverOpcionActiva(opcionActiva + 1);
  } else if (evento.key === "ArrowUp" && resultadosActuales.length) {
    evento.preventDefault();
    moverOpcionActiva(opcionActiva < 0 ? resultadosActuales.length - 1 : opcionActiva - 1);
  } else if (evento.key === "Enter") {
    const elegido = opcionActiva >= 0
      ? resultadosActuales[opcionActiva]
      : alimentoExacto(busquedaAlimento.value) || resultadosActuales[0];
    if (elegido) {
      evento.preventDefault();
      seleccionarAlimento(elegido);
    }
  } else if (evento.key === "Escape" && resultadosActuales.length) {
    evento.preventDefault();
    cerrarOpciones();
  }
});

$("agregar-alimento-tabla-hc").addEventListener("click", anadirAlimento);
inputGramosAlimento.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    evento.preventDefault();
    anadirAlimento();
  }
});
$("favorito-actual").addEventListener("click", () => {
  if (alimentoActual) toggleFavorito(alimentoActual);
});
inputRacionesExtra.addEventListener("input", leerExtra);

const inputNombrePlantilla = $("nombre-plantilla");
const selectorPlantilla = $("selector-plantilla");
const estadoPlantilla = $("estado-plantilla");

function leerPlantillas() {
  const valor = leerJson(CLAVE_PLANTILLAS, []);
  if (!Array.isArray(valor)) return [];
  const plantillas = [];
  let migradas = false;
  for (const plantilla of valor) {
    if (!plantilla || !plantilla.id || !plantilla.nombre) continue;
    const actual = migrarComidaGuardada(plantilla);
    if (actual !== plantilla) migradas = true;
    plantillas.push(actual);
  }
  if (migradas) guardarJson(CLAVE_PLANTILLAS, plantillas);
  return plantillas;
}

function renderPlantillas() {
  const seleccionAnterior = selectorPlantilla.value;
  selectorPlantilla.replaceChildren();
  const opcionVacia = document.createElement("option");
  opcionVacia.value = "";
  opcionVacia.textContent = "Elige una comida guardada";
  selectorPlantilla.append(opcionVacia);
  leerPlantillas().forEach((plantilla) => {
    const opcion = document.createElement("option");
    opcion.value = String(plantilla.id);
    opcion.textContent = plantilla.nombre;
    selectorPlantilla.append(opcion);
  });
  if ([...selectorPlantilla.options].some((opcion) => opcion.value === seleccionAnterior)) {
    selectorPlantilla.value = seleccionAnterior;
  }
}

function guardarPlantilla() {
  const nombre = inputNombrePlantilla.value.trim();
  const errorNombre = $("error-plantilla");
  const errorSelector = $("error-selector-plantilla");
  const calculo = recalcularComida();
  if (!nombre) {
    setError(inputNombrePlantilla, errorNombre, "Escribe un nombre para la plantilla.");
    inputNombrePlantilla.focus();
    return;
  }
  if (!calculo) {
    setError(inputNombrePlantilla, errorNombre, "Corrige la comida antes de guardarla.");
    return;
  }
  if (!estadoComida.alimentos.length && estadoComida.hidratosExtra === 0
    && !estadoComida.grasasManuales.length && !estadoComida.proteinasManuales.length) {
    setError(inputNombrePlantilla, errorNombre, "Añade algún alimento o nutriente antes de guardar una comida.");
    return;
  }
  borrarError(inputNombrePlantilla, errorNombre);
  borrarError(selectorPlantilla, errorSelector);
  const plantillas = leerPlantillas();
  const nueva = {
    id: crearId(),
    nombre,
    alimentos: clone(estadoComida.alimentos),
    grasasManuales: clone(estadoComida.grasasManuales),
    proteinasManuales: clone(estadoComida.proteinasManuales),
    hidratosExtra: estadoComida.hidratosExtra,
    extraVacio: estadoComida.extraVacio,
  };
  plantillas.push(nueva);
  if (!guardarJson(CLAVE_PLANTILLAS, plantillas)) {
    estadoPlantilla.textContent = "No se pudo guardar la plantilla en este dispositivo.";
    return;
  }
  renderPlantillas();
  selectorPlantilla.value = nueva.id;
  inputNombrePlantilla.value = "";
  estadoPlantilla.textContent = "Comida guardada. Al recuperarla se cargará una copia editable.";
}

function cargarPlantilla() {
  const plantilla = leerPlantillas().find((item) => String(item.id) === selectorPlantilla.value);
  if (!plantilla) {
    setError(selectorPlantilla, $("error-selector-plantilla"), "Elige una plantilla guardada.");
    return;
  }
  if (hayDatosComida() &&
    !window.confirm("¿Reemplazar la comida actual por una copia editable de esta plantilla?")) return;
  borrarError(selectorPlantilla, $("error-selector-plantilla"));
  estadoComida.alimentos = Array.isArray(plantilla.alimentos)
    ? clone(plantilla.alimentos).map((entrada) => ({ ...entrada, id: crearId() }))
    : [];
  estadoComida.grasasManuales.splice(0, estadoComida.grasasManuales.length,
    ...leerEntradasManuales(plantilla.grasasManuales));
  estadoComida.proteinasManuales.splice(0, estadoComida.proteinasManuales.length,
    ...leerEntradasManuales(plantilla.proteinasManuales));
  acumuladorGrasas.render();
  acumuladorProteinas.render();
  $("estado-hc-manual").textContent = "";
  const extra = numeroFinito(plantilla.hidratosExtra);
  estadoComida.hidratosExtra = extra !== null && extra >= 0 ? extra : 0;
  estadoComida.extraVacio = plantilla.extraVacio !== false;
  borradorExtraValido = true;
  sincronizarEntradaExtra();
  setError(inputRacionesExtra, $("error-raciones"), "");
  renderListaComida();
  guardarBorrador();
  recalcularComida();
  estadoPlantilla.textContent = `Se cargó una copia editable de «${plantilla.nombre}»; la plantilla guardada no se ha modificado.`;
}

function eliminarPlantilla() {
  const plantillas = leerPlantillas();
  const plantilla = plantillas.find((item) => String(item.id) === selectorPlantilla.value);
  if (!plantilla) {
    setError(selectorPlantilla, $("error-selector-plantilla"), "Elige una plantilla guardada.");
    return;
  }
  if (!guardarJson(CLAVE_PLANTILLAS, plantillas.filter((item) => String(item.id) !== String(plantilla.id)))) {
    estadoPlantilla.textContent = "No se pudo eliminar la plantilla guardada.";
    return;
  }
  renderPlantillas();
  estadoPlantilla.textContent = `Se eliminó la plantilla «${plantilla.nombre}».`;
}

$("guardar-plantilla").addEventListener("click", guardarPlantilla);
$("cargar-plantilla").addEventListener("click", cargarPlantilla);
$("eliminar-plantilla").addEventListener("click", eliminarPlantilla);
inputNombrePlantilla.addEventListener("input", () => borrarError(inputNombrePlantilla, $("error-plantilla")));

function hayDatosComida() {
  return Boolean(estadoComida.alimentos.length
    || estadoComida.grasasManuales.length || estadoComida.proteinasManuales.length
    || !estadoComida.extraVacio || !borradorExtraValido);
}

$("reiniciar-comida").addEventListener("click", () => {
  if (hayDatosComida() && !window.confirm("¿Reiniciar la comida actual? Se conservarán tus ajustes, favoritos y plantillas.")) return;
  estadoComida.alimentos = [];
  estadoComida.grasasManuales.length = 0;
  estadoComida.proteinasManuales.length = 0;
  acumuladorGrasas.render();
  acumuladorProteinas.render();
  $("estado-hc-manual").textContent = "";
  estadoComida.hidratosExtra = 0;
  estadoComida.extraVacio = true;
  borradorExtraValido = true;
  inputRacionesExtra.value = "";
  inputGramosAlimento.value = "";
  busquedaAlimento.value = "";
  alimentoActual = null;
  botonFavoritoActual.disabled = true;
  infoAlimento.textContent = "Elige un alimento para consultar sus datos nutricionales y su procedencia.";
  borrarError(inputRacionesExtra, $("error-raciones"));
  borrarError(inputGramosAlimento, $("error-gramos-alimento"));
  cerrarOpciones();
  guardarBorrador();
  renderListaComida();
  recalcularComida();
});

function crearAcumulador({ nombre, prefijo }) {
  const inputPor100 = $(`${prefijo}-100g`);
  const inputGramos = $(`${prefijo}-gramos`);
  const lista = $(`${prefijo}-lista`);
  const total = $(`${prefijo}-total`);
  const entradas = prefijo === "grasa" ? estadoComida.grasasManuales : estadoComida.proteinasManuales;

  function render() {
    lista.replaceChildren();
    entradas.forEach((entrada) => {
      const fila = document.createElement("li");
      const texto = document.createElement("span");
      const quitar = document.createElement("button");
      texto.textContent = `${formatear(entrada.gramos)} g`;
      quitar.type = "button";
      quitar.className = "boton-secundario";
      quitar.textContent = "Quitar";
      quitar.addEventListener("click", () => {
        const indice = entradas.findIndex((item) => item.id === entrada.id);
        if (indice >= 0) entradas.splice(indice, 1);
        render();
        guardarBorrador();
        recalcularComida();
      });
      fila.append(texto, quitar);
      lista.append(fila);
    });
    const suma = entradas.reduce((acumulado, entrada) => acumulado + entrada.gramos, 0);
    total.textContent = entradas.length ? `Total de ${nombre}: ${formatear(suma)} g.` : "";
  }

  function anadir() {
    const errorPor100 = $(`error-${prefijo}-100g`);
    const errorGramos = $(`error-${prefijo}-gramos`);
    const por100 = numeroFinito(inputPor100.value);
    const gramos = numeroFinito(inputGramos.value);
    const por100Invalido = inputPor100.validity.badInput || por100 === null || por100 < 0;
    const gramosInvalido = inputGramos.validity.badInput || gramos === null || gramos < 0;
    setError(inputPor100, errorPor100, por100Invalido
      ? "Indica un valor por 100 g finito y no negativo." : "");
    setError(inputGramos, errorGramos, gramosInvalido
      ? gramos !== null && gramos < 0 ? "La cantidad no puede ser negativa." : "Indica una cantidad finita; 0 g es válido." : "");
    if (por100Invalido || gramosInvalido) {
      resultadoUgp.textContent = "UGP no disponible: corrige los valores señalados.";
      (gramosInvalido ? inputGramos : inputPor100).focus();
      return;
    }
    const cantidad = por100 * gramos / 100;
    entradas.push({ id: crearId(), gramos: cantidad });
    inputPor100.value = "";
    inputGramos.value = "";
    render();
    guardarBorrador();
    recalcularComida();
  }

  $(`${prefijo}-anadir`).addEventListener("click", anadir);
  inputGramos.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      anadir();
    }
  });
  $(`form-${prefijo}-exactos`).addEventListener("submit", (evento) => {
    evento.preventDefault();
    const cantidad = leerCantidadExacta(prefijo);
    if (cantidad === null) return;
    entradas.push({ id: crearId(), gramos: cantidad });
    $(`${prefijo}-exactos`).value = "";
    render();
    guardarBorrador();
    recalcularComida();
    $(`${prefijo}-exactos`).focus();
  });
  render();
  return { render, getTotal: () => entradas.reduce((suma, entrada) => suma + entrada.gramos, 0) };
}

const acumuladorGrasas = crearAcumulador({ nombre: "grasas", prefijo: "grasa" });
const acumuladorProteinas = crearAcumulador({ nombre: "proteínas", prefijo: "proteina" });
const resultadoUgp = $("resultado-ugp");

function recalcularUgp() {
  let grasasProductos = 0;
  let proteinasProductos = 0;
  let productosIncompletos = false;
  const productos = estadoComida.alimentos.filter((entrada) => entrada.alimento.codigo_barras);
  for (const entrada of productos) {
    try {
      const calculo = calcularAlimento(entrada.alimento, entrada.gramos, ajustes.equivalencia);
      if (calculo.grasas === null || calculo.proteinas === null) productosIncompletos = true;
      else {
        grasasProductos += calculo.grasas;
        proteinasProductos += calculo.proteinas;
      }
    } catch {
      productosIncompletos = true;
    }
  }
  $("ugp-productos").textContent = productos.length
    ? productosIncompletos
      ? "Productos de la comida: faltan cantidades o datos de grasas/proteínas. Revisa sus etiquetas."
      : `Incluido de productos confirmados en la comida: ${formatear(grasasProductos)} g de grasas y ${formatear(proteinasProductos)} g de proteínas. Para cambiarlos o quitarlos, edita la entrada de la comida.`
    : "Todavía no hay productos escaneados aceptados en la comida.";
  if (productosIncompletos) {
    resultadoUgp.textContent = "UGP no disponible: hay productos de la comida con cantidad o nutrientes desconocidos.";
    return;
  }
  const grasas = acumuladorGrasas.getTotal() + grasasProductos;
  const proteinas = acumuladorProteinas.getTotal() + proteinasProductos;
  if (grasas === 0 && proteinas === 0 && !productos.length
    && !estadoComida.grasasManuales.length && !estadoComida.proteinasManuales.length) {
    resultadoUgp.textContent = "UGP: —";
    return;
  }
  try {
    const resultado = calcularUGP(grasas, proteinas, ajustes.kcalGrasa, ajustes.kcalProteina, ajustes.kcalUgp);
    resultadoUgp.textContent = `UGP: ${formatear(resultado.ugp)} (${formatear(resultado.kcal)} kcal; cálculo informativo, no es una dosis).`;
  } catch {
    resultadoUgp.textContent = "UGP no disponible: revisa las cantidades y los ajustes.";
  }
}

function inicializarComida() {
  borradorExtraValido = true;
  sincronizarEntradaExtra();
  renderListaComida();
  recalcularComida();
}

inputEquivalencia.value = String(ajustes.equivalencia);
inputKcalProteina.value = String(ajustes.kcalProteina);
inputKcalGrasa.value = String(ajustes.kcalGrasa);
inputKcalUgp.value = String(ajustes.kcalUgp);
escanerProductos = initProductScanner({
  getEquivalencia: () => ajustes.equivalencia,
  onAccept(alimento, cantidad) {
    const id = crearId();
    estadoComida.alimentos.push({ id, alimento: clone(alimento), gramos: cantidad });
    guardarBorrador();
    renderListaComida();
    recalcularComida();
    cambiarVista("comida");
    const fila = $(`alimento-${id}`);
    fila.focus({ preventScroll: true });
    fila.scrollIntoView({ block: "center" });
  },
  onSaved(producto) {
    productosGuardados = productosGuardados.filter((entrada) => entrada.codigo_barras !== producto.codigo_barras);
    productosGuardados.push(producto);
    $("estado-productos-guardados").textContent = `${productosGuardados.length} productos escaneados guardados en la BD, disponibles en la búsqueda de alimentos.`;
    renderOpcionesAlimento();
  },
});
document.querySelectorAll(".navegacion-app a").forEach((enlace) => {
  enlace.addEventListener("click", (evento) => {
    evento.preventDefault();
    cambiarVista(enlace.hash.slice(1));
    $(enlace.hash.slice(1)).querySelector("h2").focus();
  });
});
window.addEventListener("hashchange", actualizarVista);
window.addEventListener("popstate", actualizarVista);
actualizarVista();
inicializarTema();
inicializarComida();
renderFavoritos();
renderPlantillas();
void cargarCatalogo();
void cargarProductosGuardados();
window.addEventListener("online", () => {
  void cargarCatalogo();
  void cargarProductosGuardados();
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
