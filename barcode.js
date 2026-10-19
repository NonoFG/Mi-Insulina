import { normalizeBarcode } from "./product-data.js";

// @zxing/browser 0.1.5 (MIT) bundles @zxing/library 0.21.0 (Apache-2.0;
// its license also includes the jai-imageio notice). Retain both vendor licenses.
// NPM tarball integrity: sha512-4Lmrn/il4+UNb87Gk8h1iWnhj39TASEHpd91CwwSJtY5u+wa0iH9qS0wNLAWbNVYXR66WmT5uiMhZ7oVTrKfxw==.
const ZXING_BUNDLE_URL = "./vendor/zxing-browser.min.js";
const MAX_IMAGE_EDGE = 4096;
const MAX_IMAGE_PIXELS = 12_000_000;

let zxingPromise;

function abortError() {
  const error = new Error("La lectura de la foto se canceló.");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

async function loadZxing() {
  if (!zxingPromise) {
    zxingPromise = import(ZXING_BUNDLE_URL).then(() => {
      const zxing = globalThis.ZXingBrowser;
      if (!zxing?.BrowserMultiFormatOneDReader || !zxing?.BarcodeFormat) {
        throw new Error("El lector local de códigos no está disponible.");
      }
      return zxing;
    }).catch((error) => {
      zxingPromise = undefined;
      throw error;
    });
  }
  return zxingPromise;
}

async function loadImage(file, signal) {
  if (typeof Image === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("Este navegador no puede abrir fotos para escanear.");
  }

  const image = new Image();
  let objectUrl;
  try {
    objectUrl = URL.createObjectURL(file);
  } catch {
    throw new Error("No se pudo abrir la foto seleccionada.");
  }

  const release = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = undefined;
    }
    image.removeAttribute("src");
  };

  try {
    await new Promise((resolve, reject) => {
      const detach = () => {
        image.removeEventListener("load", onLoad);
        image.removeEventListener("error", onError);
        signal?.removeEventListener("abort", onAbort);
      };
      const onLoad = () => {
        detach();
        if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve();
        else reject(new Error("La foto no contiene una imagen válida."));
      };
      const onError = () => {
        detach();
        reject(new Error("No se pudo abrir esta imagen. Prueba con una foto JPG, PNG o WebP."));
      };
      const onAbort = () => {
        detach();
        reject(abortError());
      };

      image.addEventListener("load", onLoad, { once: true });
      image.addEventListener("error", onError, { once: true });
      signal?.addEventListener("abort", onAbort, { once: true });
      image.src = objectUrl;
    });
    throwIfAborted(signal);
    return { image, release };
  } catch (error) {
    release();
    if (signal?.aborted || error?.name === "AbortError") throw abortError();
    if (error instanceof Error && error.message.startsWith("No se pudo abrir esta imagen")) throw error;
    throw new Error("El archivo seleccionado no contiene una imagen válida.");
  }
}

function imageDimensions(image) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const scale = Math.min(
    1,
    MAX_IMAGE_EDGE / Math.max(width, height),
    Math.sqrt(MAX_IMAGE_PIXELS / (width * height)),
  );
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function drawOrientation(canvas, image, width, height, degrees) {
  const rotated = degrees === 90 || degrees === 270;
  canvas.width = rotated ? height : width;
  canvas.height = rotated ? width : height;
  let context;
  try {
    context = canvas.getContext("2d", { willReadFrequently: true });
  } catch {
    context = null;
  }
  if (!context) context = canvas.getContext("2d");
  if (!context) throw new Error("Este navegador no puede procesar la foto.");

  if (degrees === 0) {
    context.drawImage(image, 0, 0, width, height);
  } else if (degrees === 90) {
    context.translate(height, 0);
    context.rotate(Math.PI / 2);
    context.drawImage(image, 0, 0, width, height);
  } else if (degrees === 180) {
    context.translate(width, height);
    context.rotate(Math.PI);
    context.drawImage(image, 0, 0, width, height);
  } else {
    context.translate(0, width);
    context.rotate(-Math.PI / 2);
    context.drawImage(image, 0, 0, width, height);
  }
}

function nextTask(signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, 0);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Decode a local photo of an EAN/UPC barcode; the photo is never uploaded. */
export async function decodeBarcodePhoto(file, { signal } = {}) {
  throwIfAborted(signal);
  if (!file || typeof file !== "object" || typeof file.type !== "string") {
    throw new Error("Selecciona una foto para escanear el código de barras.");
  }
  if (file.type && !file.type.toLowerCase().startsWith("image/")) {
    throw new Error("El archivo seleccionado no es una imagen. Selecciona una foto.");
  }

  let imageResource;
  let canvas;
  try {
    const zxing = await loadZxing();
    throwIfAborted(signal);

    imageResource = await loadImage(file, signal);
    throwIfAborted(signal);

    const { image } = imageResource;
    const { width, height } = imageDimensions(image);
    canvas = document.createElement("canvas");
    const reader = new zxing.BrowserMultiFormatOneDReader();
    reader.possibleFormats = [
      zxing.BarcodeFormat.EAN_8,
      zxing.BarcodeFormat.EAN_13,
      zxing.BarcodeFormat.UPC_A,
      zxing.BarcodeFormat.ITF,
    ];

    for (const degrees of [0, 90, 180, 270]) {
      throwIfAborted(signal);
      drawOrientation(canvas, image, width, height, degrees);
      try {
        const result = reader.decodeFromCanvas(canvas);
        return normalizeBarcode(result.getText());
      } catch (error) {
        if (signal?.aborted || error?.name === "AbortError") throw abortError();
      }
      if (degrees !== 270) await nextTask(signal);
    }

    throw new Error("No se encontró un código de barras válido en la foto. Acerca la etiqueta y vuelve a intentarlo.");
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError") throw abortError();
    if (error instanceof Error && error.message.startsWith("No se encontró un código")) throw error;
    throw new Error("No se pudo leer el código de barras de la foto. Prueba con una imagen más nítida y bien iluminada.");
  } finally {
    imageResource?.release();
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
  }
}

const cameraSessions = new WeakMap();
const RECOVERABLE_DECODER_ERRORS = new Set([
  "NotFoundException",
  "ChecksumException",
  "FormatException",
]);

function cameraAbortError() {
  const error = new Error("El escaneo con cámara se canceló.");
  error.name = "AbortError";
  return error;
}

function cameraAcquisitionError(error) {
  let message;
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      message = "No se pudo acceder a la cámara. Permite su uso en el navegador o utiliza una foto o el código manual.";
      break;
    case "NotFoundError":
    case "DevicesNotFoundError":
      message = "No se encontró una cámara disponible. Puedes usar una foto o introducir el código manualmente.";
      break;
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      message = "La cámara no pudo iniciarse. Comprueba que no esté siendo usada por otra aplicación o utiliza una foto o el código manual.";
      break;
    case "SecurityError":
      message = "El navegador bloqueó la cámara. Usa HTTPS o localhost y revisa los permisos; también puedes usar una foto o el código manual.";
      break;
    default:
      message = "No se pudo iniciar la cámara. Revisa los permisos o utiliza una foto o el código manual.";
  }
  return new Error(message, { cause: error });
}

/** Read one valid code, releasing the camera before resolving or rejecting. */
export function decodeBarcodeCamera(video, { signal, onReady } = {}) {
  if (signal?.aborted) return Promise.reject(cameraAbortError());

  return new Promise((resolve, reject) => {
    let settled = false;
    let stream = null;
    let controls = null;
    let finishPreview = null;
    const listeners = [];
    const stopTracks = (media) => media?.getTracks().forEach((track) => track.stop());
    const listen = (target, type, listener) => {
      target.addEventListener(type, listener);
      listeners.push([target, type, listener]);
    };
    const finish = (error, code) => {
      if (settled) return;
      settled = true;
      for (const [target, type, listener] of listeners) target.removeEventListener(type, listener);
      controls?.stop();
      stopTracks(stream);
      if (stream && video.srcObject === stream) {
        video.pause();
        video.srcObject = null;
      }
      finishPreview?.(false);
      if (cameraSessions.get(video) === cancel) cameraSessions.delete(video);
      if (error) reject(error);
      else resolve(code);
    };
    const cancel = () => finish(cameraAbortError());
    const active = () => !settled && !signal?.aborted;
    const ready = () => video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2;

    cameraSessions.get(video)?.();
    cameraSessions.set(video, cancel);
    if (signal) {
      listen(signal, "abort", cancel);
      if (signal.aborted) {
        cancel();
        return;
      }
    }

    const start = async () => {
      if (globalThis.isSecureContext === false) {
        throw new Error("La cámara requiere HTTPS o localhost. Puedes usar una foto o introducir el código manualmente.");
      }
      if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Este navegador no permite usar la cámara aquí. Puedes usar una foto o el código manual.");
      }
      const zxing = await loadZxing();
      if (!active()) return;

      let acquired;
      try {
        acquired = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
      } catch (error) {
        throw cameraAcquisitionError(error);
      }
      // Permission prompts cannot be aborted. Release a late grant without attaching it.
      if (!active()) {
        stopTracks(acquired);
        return;
      }
      stream = acquired;
      const lost = () => finish(new Error("Se perdió la conexión con la cámara. Vuelve a activarla o usa una foto o el código manual."));
      const tracks = stream.getVideoTracks();
      for (const track of tracks) listen(track, "ended", lost);
      listen(stream, "inactive", lost);
      if (!tracks.length || tracks.some((track) => track.readyState === "ended") || !stream.active) {
        lost();
        return;
      }
      listen(video, "error", () => finish(new Error("No se pudo mostrar la cámara. Vuelve a activarla o utiliza una foto o el código manual.")));
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      const preview = new Promise((complete) => {
        finishPreview = complete;
        const check = () => { if (active() && ready()) complete(true); };
        for (const type of ["loadeddata", "canplay", "playing"]) listen(video, type, check);
        check();
      });
      try {
        await video.play();
      } catch (error) {
        if (!active()) return;
        throw new Error("No se pudo reproducir la cámara. Vuelve a activarla o utiliza una foto o el código manual.", { cause: error });
      }
      if (!active() || !await preview || !active()) return;
      onReady?.();
      if (!active()) return;

      const reader = new zxing.BrowserMultiFormatOneDReader(undefined, {
        delayBetweenScanAttempts: 200,
        delayBetweenScanSuccess: 200,
      });
      reader.possibleFormats = [
        zxing.BarcodeFormat.EAN_8,
        zxing.BarcodeFormat.EAN_13,
        zxing.BarcodeFormat.UPC_A,
        zxing.BarcodeFormat.ITF,
      ];
      try {
        controls = reader.scan(video, (result, error, scanControls) => {
          controls = scanControls;
          if (!active()) {
            controls.stop();
            return;
          }
          if (error) {
            const kind = error.getKind?.() ?? error.constructor?.kind;
            if (!RECOVERABLE_DECODER_ERRORS.has(kind)) {
              finish(new Error("El lector no pudo analizar la cámara. Vuelve a activarla o utiliza una foto o el código manual."));
            }
            return;
          }
          if (!result) return;
          let code;
          try {
            code = normalizeBarcode(result.getText());
          } catch {
            return;
          }
          finish(null, code);
        });
        // ZXing can decode synchronously and schedule a timer after the callback stopped it.
        if (settled) controls.stop();
      } catch (error) {
        if (active()) throw new Error("No se pudo iniciar el lector de la cámara. Usa una foto o el código manual.", { cause: error });
      }
    };
    void start().catch((error) => finish(error));
  });
}
