import { decodeBarcodeCamera, decodeBarcodePhoto } from "./barcode.js";
import { lookupProduct, saveProduct } from "./products.js";
import { normalizeBarcode } from "./product-data.js";
import { numeroFinito } from "./calculos.js";

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const mostrar = (valor) => valor === null ? "desconocidos" : `${formato.format(valor)} g`;

/** La consulta y el guardado no modifican la comida; solo onAccept lo hace. */
export function initProductScanner({ onAccept, onSaved, getEquivalencia }) {
  const foto = $("foto-producto");
  const codigo = $("codigo-producto");
  const estado = $("estado-escaner");
  const revision = $("revision-producto");
  const cancelar = $("cancelar-consulta-producto");
  const guardar = $("guardar-producto");
  const estadoGuardar = $("estado-guardar-producto");
  const activarCamara = $("activar-camara");
  const panelCamara = $("panel-camara");
  const videoProducto = $("video-producto");
  const botonDetenerCamara = $("detener-camara");
  const estadoCamara = $("estado-camara");
  let pendiente = null;
  let consulta = null;
  let generacion = 0;
  let camaraActiva = false;

  function errorCampo(id, mensaje) {
    const input = $(id);
    $(`error-${id}`).textContent = mensaje;
    input.classList.toggle("error", Boolean(mensaje));
    if (mensaje) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function leerRevision(mostrarErrores = false) {
    if (!pendiente) return null;
    let valido = true;
    let primerError = null;
    const validar = (id, mensaje) => {
      if (mensaje) { valido = false; primerError ??= $(id); }
      if (mostrarErrores || $(id).hasAttribute("aria-invalid")) errorCampo(id, mensaje);
    };
    const nombre = $("producto-nombre").value.trim();
    validar("producto-nombre", nombre ? "" : "Indica el nombre del producto.");
    const cantidad = numeroFinito($("producto-cantidad").value);
    validar("producto-cantidad", $("producto-cantidad").validity.badInput || cantidad === null || cantidad <= 0
      ? "Indica la cantidad que vas a consumir, mayor que cero." : "");
    const nutrientes = {};
    for (const [campo, propiedad] of [["hc", "carbs_100g"], ["grasas", "grasas_100g"], ["proteinas", "proteinas_100g"]]) {
      const input = $(`producto-${campo}`);
      const valor = numeroFinito(input.value);
      validar(input.id, input.validity.badInput || (valor === null ? campo === "hc" || input.value !== "" : valor < 0 || valor > 100)
        ? "Indica gramos entre 0 y 100; los hidratos son necesarios para añadir." : "");
      nutrientes[propiedad] = valor;
    }
    if (!valido) {
      if (mostrarErrores) primerError.focus();
      return null;
    }
    const original = pendiente.product;
    const editado = nombre !== original.nombre || Object.entries(nutrientes).some(([campo, valor]) => valor !== original[campo]);
    return {
      cantidad,
      product: {
        ...original,
        ...nutrientes,
        nombre,
        fuente: editado ? "Open Food Facts; valores editados para esta comida por el usuario" : original.fuente,
      },
    };
  }

  function updatePreview() {
    if (!pendiente) return;
    const datos = leerRevision();
    if (!datos) {
      $("totales-producto").textContent = "Completa los hidratos y la cantidad para calcular la vista previa. Todavía no se ha añadido nada.";
      return;
    }
    const { product, cantidad } = datos;
    const hc = product.carbs_100g * cantidad / 100;
    const grasas = product.grasas_100g === null ? null : product.grasas_100g * cantidad / 100;
    const proteinas = product.proteinas_100g === null ? null : product.proteinas_100g * cantidad / 100;
    $("totales-producto").textContent = `Para ${formato.format(cantidad)} ${product.unidad_cantidad}: ${mostrar(hc)} HC · grasas: ${mostrar(grasas)} · proteínas: ${mostrar(proteinas)} · ${formato.format(hc / getEquivalencia())} raciones. Pendiente de tu aceptación.`;
  }

  function cerrarPanelCamara() {
    camaraActiva = false;
    panelCamara.hidden = true;
    activarCamara.disabled = false;
    activarCamara.setAttribute("aria-expanded", "false");
  }

  function detenerConsulta() {
    generacion += 1;
    consulta?.abort();
    consulta = null;
    cancelar.hidden = true;
    $("form-codigo-producto").removeAttribute("aria-busy");
    cerrarPanelCamara();
  }

  function detenerCamara(mensaje = "Escaneo cancelado. No se ha añadido nada.") {
    if (!camaraActiva) return false;
    detenerConsulta();
    estadoCamara.textContent = mensaje;
    estado.textContent = mensaje;
    return true;
  }

  function stop() {
    const estabaEscaneando = camaraActiva;
    detenerConsulta();
    if (estabaEscaneando) {
      const mensaje = "Cámara detenida al salir de esta pantalla. No se ha añadido nada.";
      estadoCamara.textContent = mensaje;
      estado.textContent = mensaje;
    }
  }

  async function iniciarCamara() {
    detenerConsulta();
    const actual = generacion;
    const controller = new AbortController();
    consulta = controller;
    camaraActiva = true;
    activarCamara.disabled = true;
    panelCamara.hidden = false;
    activarCamara.setAttribute("aria-expanded", "true");
    estadoCamara.textContent = "Solicitando permiso para usar la cámara… Puedes detener el escaneo en cualquier momento.";
    estado.textContent = "Preparando la cámara…";
    botonDetenerCamara.focus({ preventScroll: true });
    try {
      const code = await decodeBarcodeCamera(videoProducto, {
        signal: controller.signal,
        onReady() {
          if (actual !== generacion || consulta !== controller || !camaraActiva) return;
          estadoCamara.textContent = "Cámara activa. Enfoca un código de barras dentro del recuadro.";
          estado.textContent = "La cámara se apagará al detectar un código válido. Todavía no se ha añadido nada.";
        },
      });
      if (actual !== generacion || consulta !== controller || !camaraActiva) return;
      consulta = null;
      cerrarPanelCamara();
      codigo.value = code;
      estado.textContent = `Código ${code} detectado. Consultando el producto…`;
      void consultar();
    } catch (error) {
      if (actual !== generacion || consulta !== controller || controller.signal.aborted) return;
      consulta = null;
      cerrarPanelCamara();
      const mensaje = error instanceof Error ? error.message : "No se pudo iniciar la cámara. Puedes probar con una foto o escribir el código.";
      estadoCamara.textContent = mensaje;
      estado.textContent = mensaje;
      activarCamara.focus({ preventScroll: true });
    }
  }

  activarCamara.addEventListener("click", () => {
    void iniciarCamara();
  });
  botonDetenerCamara.addEventListener("click", () => {
    if (detenerCamara()) activarCamara.focus({ preventScroll: true });
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && camaraActiva) {
      evento.preventDefault();
      if (detenerCamara()) activarCamara.focus({ preventScroll: true });
    }
  });
  window.addEventListener("pagehide", () => {
    detenerCamara("Cámara detenida al salir de la página. No se ha añadido nada.");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) detenerCamara("Cámara detenida al cambiar de aplicación. No se ha añadido nada.");
  });
  foto.addEventListener("click", () => {
    if (!consulta && !camaraActiva) return;
    detenerConsulta();
    estado.textContent = "Consulta detenida. Elige una foto para continuar.";
    estadoCamara.textContent = "Cámara detenida al elegir una foto.";
  });
  codigo.addEventListener("focus", () => {
    if (!consulta && !camaraActiva) return;
    detenerConsulta();
    estado.textContent = "Consulta detenida. Escribe el código y consúltalo cuando quieras.";
    estadoCamara.textContent = "Cámara detenida al cambiar a la entrada manual.";
  });

  function reviewProduct(product, { saved = false, storageAvailable = true } = {}) {
    detenerConsulta();
    pendiente = { product: { ...product }, saved, saving: false };
    revision.hidden = false;
    codigo.value = product.codigo_barras;
    $("producto-nombre").value = product.nombre;
    $("producto-hc").value = product.carbs_100g ?? "";
    $("producto-grasas").value = product.grasas_100g ?? "";
    $("producto-proteinas").value = product.proteinas_100g ?? "";
    $("producto-cantidad").value = product.cantidad_sugerida ?? "";
    for (const id of ["producto-nombre", "producto-hc", "producto-grasas", "producto-proteinas", "producto-cantidad"]) errorCampo(id, "");
    errorCampo("codigo-producto", "");
    $("producto-base").textContent = `Valores nutricionales por 100 ${product.unidad_cantidad}. La cantidad a consumir se indica debajo.`;
    $("etiqueta-producto-cantidad").textContent = `Cantidad a consumir (${product.unidad_cantidad}):`;
    $("ayuda-producto-cantidad").textContent = `${product.descripcion_cantidad || "No se conoce una porción: indica cuánto vas a consumir."} Revisa siempre la cantidad sugerida; no es una recomendación de consumo.`;
    const fecha = new Date(product.consultado_en);
    $("origen-producto").textContent = `Código ${product.codigo_barras}${product.marca ? ` · ${product.marca}` : ""}. Fuente: Open Food Facts${Number.isFinite(fecha.getTime()) ? `. Consultado: ${fecha.toLocaleDateString("es-ES")}` : ""}. La fecha de consulta no acredita una revisión nutricional.`;
    $("enlace-producto").href = `https://world.openfoodfacts.org/product/${encodeURIComponent(product.codigo_barras)}`;
    guardar.disabled = saved;
    guardar.textContent = saved ? "Ficha ya guardada en la BD" : "Guardar ficha original en la BD";
    estadoGuardar.textContent = saved ? "Producto disponible en el catálogo guardado." : storageAvailable
      ? "" : "La BD de productos no está disponible o todavía no está configurada. Puedes revisar y añadir a la comida; guardar requiere el servidor de Supabase.";
    estado.textContent = "Producto encontrado. Revisa la etiqueta y la cantidad antes de aceptar.";
    updatePreview();
    $("titulo-revision-producto").focus();
  }

  async function consultar(archivo = null) {
    detenerConsulta();
    pendiente = null;
    revision.hidden = true;
    errorCampo("codigo-producto", "");
    const actual = generacion;
    const controller = new AbortController();
    consulta = controller;
    cancelar.hidden = false;
    $("form-codigo-producto").setAttribute("aria-busy", "true");
    try {
      estado.textContent = archivo ? "Leyendo el código de la foto en este dispositivo…" : "Consultando el producto…";
      const code = archivo ? await decodeBarcodePhoto(archivo, { signal: controller.signal }) : normalizeBarcode(codigo.value);
      if (actual !== generacion) return;
      codigo.value = code;
      estado.textContent = `Consultando información de ${code}…`;
      const resultado = await lookupProduct(code, { signal: controller.signal });
      if (actual !== generacion) return;
      reviewProduct(resultado.product, resultado);
    } catch (error) {
      if (actual !== generacion || controller.signal.aborted) return;
      const mensaje = error instanceof Error ? error.message : "No se pudo consultar el producto.";
      estado.textContent = mensaje;
      if (!archivo) errorCampo("codigo-producto", mensaje);
    } finally {
      if (actual === generacion) {
        consulta = null;
        cancelar.hidden = true;
        $("form-codigo-producto").removeAttribute("aria-busy");
      }
    }
  }

  $("form-codigo-producto").addEventListener("submit", (evento) => {
    evento.preventDefault();
    void consultar();
  });
  codigo.addEventListener("input", () => {
    detenerConsulta();
    pendiente = null;
    revision.hidden = true;
    estado.textContent = "Código modificado. Consulta el producto para revisar sus datos.";
  });
  foto.addEventListener("change", () => {
    const archivo = foto.files?.[0];
    foto.value = "";
    if (archivo) void consultar(archivo);
  });
  cancelar.addEventListener("click", () => {
    detenerConsulta();
    estado.textContent = "Consulta cancelada. No se ha añadido nada.";
  });
  $("descartar-producto").addEventListener("click", () => {
    detenerConsulta();
    pendiente = null;
    revision.hidden = true;
    estado.textContent = "Producto descartado. No se ha añadido a la comida.";
    codigo.focus();
  });
  $("form-aceptar-producto").addEventListener("input", updatePreview);
  $("form-aceptar-producto").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const datos = leerRevision(true);
    if (!datos) return;
    detenerConsulta();
    pendiente = null;
    revision.hidden = true;
    onAccept(datos.product, datos.cantidad);
    estado.textContent = `${datos.product.nombre}: añadido a la comida con ${formato.format(datos.cantidad)} ${datos.product.unidad_cantidad}. Sus grasas y proteínas se incluyen en UGP; los datos desconocidos no se sustituyen por cero.`;
  });
  guardar.addEventListener("click", async () => {
    const actual = pendiente;
    if (!actual || actual.saved || actual.saving) return;
    actual.saving = true;
    guardar.disabled = true;
    estadoGuardar.textContent = "Guardando la ficha original en la BD…";
    try {
      const product = await saveProduct(actual.product.codigo_barras);
      onSaved(product);
      actual.saved = true;
      if (pendiente !== actual) return;
      guardar.textContent = "Ficha ya guardada en la BD";
      estadoGuardar.textContent = "Ficha original guardada en la BD. Esto no la añade a la comida.";
    } catch (error) {
      if (pendiente !== actual) return;
      estadoGuardar.textContent = error instanceof Error ? error.message : "No se pudo guardar en la BD. No se ha guardado una copia remota.";
    } finally {
      actual.saving = false;
      if (pendiente === actual) guardar.disabled = actual.saved;
    }
  });

  return { reviewProduct, updatePreview, stop };
}
