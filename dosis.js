document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("dosisForm");
  const resultadoDiv = document.getElementById("resultado");
  const historialDiv = document.getElementById("historial");

  const temaRadios = document.querySelectorAll('input[name="tema"]');
  const body = document.body;
/*
  // Cargar tema anterior si existe
  const temaGuardado = localStorage.getItem("tema");
  if (temaGuardado) {
    body.setAttribute("data-tema", temaGuardado);
    document.querySelector(`input[value="${temaGuardado}"]`).checked = true;
  }*/

  // --- 🌙 Lógica de Tema Automático ---
  const setTemaPorHora = () => {
    const hora = new Date().getHours();
    // Define el rango horario para el modo oscuro
    // Fuera de ese rango, será modo claro.
    if (hora >= 20 || hora < 6) {
      return "oscuro"; // Modo oscuro
    } else {
      return "claro"; // Modo claro
    }
  };

  // 0. Determinar el tema inicial
/*
  const temaGuardado = localStorage.getItem("tema");
  const temaInicial = temaGuardado ? temaGuardado : setTemaPorHora(); // Prioriza el tema guardado
  */
// 1. Determinar el tema inicial (SIEMPRE por hora)
  const temaInicial = setTemaPorHora();

  // 2. Aplicar el tema inicial 
  body.setAttribute("data-tema", temaInicial);

  // 3. Marcar el radio button correcto
  const radioInicial = document.querySelector(`input[value="${temaInicial}"]`);
  if (radioInicial) {
    radioInicial.checked = true;
  }
  
  // 4. Cambiar tema manualmente (y guardarlo)
  temaRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      body.setAttribute("data-tema", radio.value);
      localStorage.setItem("tema", radio.value);
    });
  });
  // --- ----------------------------- ---
/*
  // Cambiar tema manualmente
  temaRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      body.setAttribute("data-tema", radio.value);
      localStorage.setItem("tema", radio.value);
    });
  });
*/
  
  //Manejar el selector de comida para actualizar la relación I/C
  const comidaRadios = document.querySelectorAll('input[name="comida"]');
  const relacionInput = document.getElementById("relacion");

  comidaRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      relacionInput.value = radio.value;
    });
  });

  const comidaConfortSelect = document.getElementById("comida-confort");
  const racionesInput = document.getElementById("raciones");
  const alimentoTablaHCInput = document.getElementById("alimento-tabla-hc");
  const gramosTablaHCInput = document.getElementById("gramos-tabla-hc");
  const agregarAlimentoTablaHCButton = document.getElementById("agregar-alimento-tabla-hc");
  const alimentosTablaHCList = document.getElementById("alimentos-tabla-hc-list");
  const alimentosTablaHCSeleccionadosList = document.getElementById("alimentos-tabla-hc-seleccionados");
  const estadoTablaHC = document.getElementById("estado-tabla-hc");
  const resumenTablaHC = document.getElementById("resumen-tabla-hc");
  const resumenRacionesTotal = document.getElementById("resumen-raciones-total");

  const SUPABASE_CONFIG = {
    url: "https://ncyzseuzetwgeluptqdl.supabase.co", 
    anonKey: "sb_publishable_ci4a4vZF_qdWRW-mpNaB2g_dckTqJ1h",
    table: "alimentos",
    select: "id,nombre,carbs_100g,gramos_1_racion_hc,medida_habitual,raciones_hc_medida,ig,categorias(nombre),detalles_medida(medida,raciones_hc)",
  };

  let racionesComidaConfort = 0;

  const getRacionesManuales = () => {
    const valor = parseFloat(racionesInput.value);
    return Number.isFinite(valor) ? valor : 0;
  };

  const actualizarResumenRaciones = () => {
    const racionesTablaHCTotal = getRacionesTablaHC();
    const racionesManuales = getRacionesManuales();
    const total = racionesComidaConfort + racionesTablaHCTotal + racionesManuales;
    const crearLineaResumen = (operador, texto, valor) =>
      `${operador} ${texto.padEnd(10, " ")}${formatNumero(valor).padStart(5, " ")}`;

    resumenRacionesTotal.textContent = [
      crearLineaResumen(" ", "confort", racionesComidaConfort),
      crearLineaResumen(" ", "alimentos", racionesTablaHCTotal),
      crearLineaResumen("+", "extra", racionesManuales),
      "------------------",
      crearLineaResumen(" ", "raciones", total),
    ].join("\n");
  };

  comidaConfortSelect.addEventListener("change", () => {
    const selectedOption = comidaConfortSelect.value;
    let racionesValor = 0;

    switch (selectedOption) {
      case 'gyozas':
        racionesValor = 5.29;
        break;
      case 'ensalada-cesar':
        racionesValor = 1.47;
        break;
      case 'patatas-de-lux':
        racionesValor = 8.63;
        break;
      default:
        racionesValor = 0;
    }

    racionesComidaConfort = racionesValor;
    actualizarResumenRaciones();
  });

  let alimentosTablaHC = [];
  let alimentosSeleccionadosTablaHC = [];

  const formatNumero = (valor) => {
    if (!Number.isFinite(valor)) return "0";
    return valor.toFixed(2).replace(/\.?0+$/, "");
  };

  const normalizarTexto = (valor) => String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const parsePosibleJSON = (valor) => {
    if (typeof valor !== "string") return valor;

    try {
      return JSON.parse(valor);
    } catch (error) {
      return valor;
    }
  };

  const parseNumero = (valor) => {
    if (valor === null || valor === undefined || valor === "") return null;
    const numero = Number(String(valor).replace(",", "."));
    return Number.isFinite(numero) ? numero : null;
  };

  const getGramosUnaRacion = (alimento) => {
    const valor = alimento.gramos1RacionHC;
    if (typeof valor === "string" && normalizarTexto(valor).includes("sin hc")) return 0;

    return parseNumero(valor);
  };

  const getCarbs100g = (alimento) => parseNumero(alimento.carbs100g);

  const getRacionesDesdeCarbs100g = (alimento, gramos) => {
    const carbs100g = getCarbs100g(alimento);
    if (carbs100g === 0) return 0;
    if (!carbs100g || carbs100g <= 0) return null;

    return ((gramos * carbs100g) / 100) / 10;
  };

  const calcularRacionesAlimento = (alimento, gramos) => {
    const gramosUnaRacion = getGramosUnaRacion(alimento);
    if (gramosUnaRacion === 0) return 0;
    if (!gramosUnaRacion || gramosUnaRacion <= 0) {
      return getRacionesDesdeCarbs100g(alimento, gramos);
    }

    return gramos / gramosUnaRacion;
  };

  const getInfoAlimento = (alimento) => {
    const gramosUnaRacion = getGramosUnaRacion(alimento);
    const carbs100g = getCarbs100g(alimento);
    if (gramosUnaRacion === 0) return "Sin HC";
    if (!gramosUnaRacion && !carbs100g) return "No valorable";

    const partes = [];
    if (gramosUnaRacion) partes.push(`1 racion HC = ${gramosUnaRacion}g`);
    if (carbs100g) partes.push(`${formatNumero(carbs100g)}g HC/100g`);
    if (alimento.medidaHabitual) partes.push(alimento.medidaHabitual);
    if (alimento.ig !== null && alimento.ig !== undefined) partes.push(`IG ${alimento.ig}`);

    return partes.join(" | ");
  };

  const crearEtiquetaAlimento = (alimento) => {
    const seccion = alimento.seccion ? ` (${alimento.seccion})` : "";
    return `${alimento.nombre}${seccion}`;
  };

  const normalizarAlimentosTablaHC = (respuesta) => {
    const alimentos = [];
    const raiz = Array.isArray(respuesta) ? respuesta : [respuesta];

    const agregarAlimento = (entrada, seccionFallback = "") => {
      const item = parsePosibleJSON(entrada);
      if (!item || typeof item !== "object") return;

      if (Array.isArray(item)) {
        item.forEach((subItem) => agregarAlimento(subItem, seccionFallback));
        return;
      }

      if (Array.isArray(item.alimentos)) {
        item.alimentos.forEach((alimento) => agregarAlimento(alimento, item.seccion || seccionFallback));
        return;
      }

      const columnasJSON = ["data", "bd", "json", "contenido", "tabla"];
      for (const columna of columnasJSON) {
        const valor = parsePosibleJSON(item[columna]);
        if (Array.isArray(valor)) {
          valor.forEach((subItem) => agregarAlimento(subItem, item.seccion || seccionFallback));
          return;
        }
      }

      const nombre = item.alimento || item.nombre || item.name;
      if (!nombre) return;

      const alimento = {
        id: item.id ?? `${alimentos.length}-${normalizarTexto(nombre)}`,
        nombre,
        seccion: item.seccion || item.categorias?.nombre || item.categoria?.nombre || seccionFallback,
        carbs100g: item.carbs_100g ?? item.carbs100g ?? item.carbsPer100 ?? null,
        gramos1RacionHC: item.gramos_1_racion_hc ?? item.gramos1RacionHC ?? item.gramos_1_racion,
        medidaHabitual: item.medida_habitual ?? item.medidaHabitual ?? null,
        racionesMedida: item.raciones_hc_medida ?? item.racionesMedida ?? null,
        detallesMedida: item.detalles_medida ?? item.detallesMedida ?? [],
        ig: item.ig ?? null,
      };

      alimento.etiqueta = crearEtiquetaAlimento(alimento);
      alimentos.push(alimento);
    };

    raiz.forEach((item) => agregarAlimento(item));

    return alimentos.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
  };

  const getRacionesTablaHC = () => alimentosSeleccionadosTablaHC
    .reduce((total, alimento) => total + alimento.raciones, 0);

  const renderResumenTablaHC = () => {
    const total = getRacionesTablaHC();
    resumenTablaHC.textContent = `${formatNumero(total)} ${total === 1 ? "racion anadida" : "raciones anadidas"}`;
    actualizarResumenRaciones();
  };

  const renderAlimentosSeleccionadosTablaHC = () => {
    alimentosTablaHCSeleccionadosList.innerHTML = "";

    alimentosSeleccionadosTablaHC.forEach((alimentoSeleccionado) => {
      const item = document.createElement("li");
      const texto = document.createElement("span");
      const quitarButton = document.createElement("button");

      texto.textContent = `${alimentoSeleccionado.nombre}: ${formatNumero(alimentoSeleccionado.gramos)}g = ${formatNumero(alimentoSeleccionado.raciones)} raciones`;
      quitarButton.type = "button";
      quitarButton.textContent = "Quitar";
      quitarButton.addEventListener("click", () => {
        alimentosSeleccionadosTablaHC = alimentosSeleccionadosTablaHC
          .filter((alimento) => alimento.id !== alimentoSeleccionado.id);
        renderAlimentosSeleccionadosTablaHC();
        renderResumenTablaHC();
      });

      item.append(texto, quitarButton);
      alimentosTablaHCSeleccionadosList.appendChild(item);
    });

    renderResumenTablaHC();
  };

  const ocultarOpcionesTablaHC = () => {
    alimentosTablaHCList.innerHTML = "";
    alimentosTablaHCList.classList.remove("visible");
  };

  const seleccionarAlimentoTablaHC = (alimento) => {
    alimentoTablaHCInput.value = alimento.etiqueta;
    estadoTablaHC.textContent = getInfoAlimento(alimento);
    ocultarOpcionesTablaHC();
    gramosTablaHCInput.focus();
  };

  const getAlimentosFiltradosTablaHC = () => {
    const busqueda = normalizarTexto(alimentoTablaHCInput.value);
    if (!busqueda) return [];

    return alimentosTablaHC
      .filter((alimento) => normalizarTexto(alimento.etiqueta).includes(busqueda))
      .slice(0, 8);
  };

  const renderOpcionesTablaHC = () => {
    const alimentosFiltrados = getAlimentosFiltradosTablaHC();
    alimentosTablaHCList.innerHTML = "";

    if (!alimentosFiltrados.length) {
      ocultarOpcionesTablaHC();
      return;
    }

    alimentosFiltrados.forEach((alimento) => {
      const option = document.createElement("button");
      const nombre = document.createElement("span");
      const info = document.createElement("small");

      option.type = "button";
      option.className = "opcion-tabla-hc";
      option.setAttribute("role", "option");
      nombre.textContent = alimento.nombre;
      info.textContent = getInfoAlimento(alimento);
      option.addEventListener("mousedown", (event) => {
        event.preventDefault();
        seleccionarAlimentoTablaHC(alimento);
      });

      option.append(nombre, info);
      alimentosTablaHCList.appendChild(option);
    });

    alimentosTablaHCList.classList.add("visible");
  };

  const buscarAlimentoTablaHC = () => {
    const busqueda = normalizarTexto(alimentoTablaHCInput.value);
    return alimentosTablaHC.find((alimento) => normalizarTexto(alimento.etiqueta) === busqueda)
      || alimentosTablaHC.find((alimento) => normalizarTexto(alimento.nombre) === busqueda);
  };

  const actualizarAyudaAlimentoTablaHC = () => {
    const alimento = buscarAlimentoTablaHC();
    renderOpcionesTablaHC();

    if (!alimento) {
      estadoTablaHC.textContent = alimentosTablaHC.length
        ? `${alimentosTablaHC.length} alimentos cargados. Escribe para buscar por nombre.`
        : "Configura Supabase para cargar los alimentos.";
      return;
    }

    estadoTablaHC.textContent = getInfoAlimento(alimento);
  };

  const agregarAlimentoTablaHC = () => {
    const alimento = buscarAlimentoTablaHC();
    const gramos = parseFloat(gramosTablaHCInput.value);

    if (!alimento) {
      estadoTablaHC.textContent = "Elige un alimento de la lista.";
      return;
    }

    if (!Number.isFinite(gramos) || gramos <= 0) {
      estadoTablaHC.textContent = "Indica los gramos que vas a comer.";
      gramosTablaHCInput.focus();
      return;
    }

    const raciones = calcularRacionesAlimento(alimento, gramos);
    if (raciones === null) {
      estadoTablaHC.textContent = "Este alimento no tiene raciones calculables.";
      return;
    }

    alimentosSeleccionadosTablaHC.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      nombre: alimento.nombre,
      gramos,
      raciones,
    });

    alimentoTablaHCInput.value = "";
    gramosTablaHCInput.value = "";
    estadoTablaHC.textContent = "Alimento anadido al calculo.";
    renderAlimentosSeleccionadosTablaHC();
  };

  const cargarAlimentosTablaHC = async () => {
    if (!alimentoTablaHCInput) return;

    const url = SUPABASE_CONFIG.url.trim().replace(/\/$/, "");
    const anonKey = SUPABASE_CONFIG.anonKey.trim();

    if (!url || !anonKey) {
      estadoTablaHC.textContent = "Configura SUPABASE_CONFIG en dosis.js para cargar alimentos.";
      renderResumenTablaHC();
      return;
    }

    estadoTablaHC.textContent = "Cargando alimentos...";

    try {
      const params = new URLSearchParams({
        select: SUPABASE_CONFIG.select,
        order: "nombre.asc",
      });
      const response = await fetch(`${url}/rest/v1/${encodeURIComponent(SUPABASE_CONFIG.table)}?${params}`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase respondio ${response.status}`);
      }

      const data = await response.json();
      alimentosTablaHC = normalizarAlimentosTablaHC(data);
      actualizarAyudaAlimentoTablaHC();
    } catch (error) {
      estadoTablaHC.textContent = "No se pudieron cargar los alimentos desde Supabase.";
      console.error(error);
    }
  };

  alimentoTablaHCInput.addEventListener("input", actualizarAyudaAlimentoTablaHC);
  alimentoTablaHCInput.addEventListener("focus", renderOpcionesTablaHC);
  alimentoTablaHCInput.addEventListener("blur", () => {
    setTimeout(ocultarOpcionesTablaHC, 120);
  });
  agregarAlimentoTablaHCButton.addEventListener("click", agregarAlimentoTablaHC);
  racionesInput.addEventListener("input", actualizarResumenRaciones);
  gramosTablaHCInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      agregarAlimentoTablaHC();
    }
  });

  actualizarResumenRaciones();
  cargarAlimentosTablaHC();

  // Historial en memoria
  const historial = [];

  // Lógica para seleccionar la comida por la hora
  const horaActual = new Date().getHours();
  const minutosActuales = new Date().getMinutes();

  const getComidaPorHora = (hora, minutos) => {
    // Desayuno: de 04:00 a 12:29
    if ((hora >= 4 && hora < 12) || (hora === 12 && minutos < 30) || (hora >= 0 && hora < 4)) {
      return "desayuno";
    }
    // Comida: de 12:30 a 16:29
    if ((hora === 12 && minutos >= 30) || (hora > 12 && hora < 16) || (hora === 16 && minutos < 30)) {
      return "comida";
    }
    // Merienda: de 16:30 a 19:59
    if ((hora === 16 && minutos >= 30) || (hora > 16 && hora < 20)) {
      return "merienda";
    }
    // Cena: de 20:00 a 03:59
    if (hora >= 20 || hora < 4) {
      return "cena";
    }
    return "desayuno"; // Valor por defecto
  };


  const comidaPorDefecto = getComidaPorHora(horaActual, minutosActuales);
  const radioComida = document.querySelector(`input[name="comida"][data-comida-nombre="${comidaPorDefecto}"]`);
  if (radioComida) {
    radioComida.checked = true;
    radioComida.dispatchEvent(new Event('change'));
  }


  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const racionesTablaHCTotal = getRacionesTablaHC();
    const fields = [
      { id: "glucosa", nombre: "nivel de glucosa" },
      { id: "relacion", nombre: "índice de insulina" },
      { id: "correccion", nombre: "factor de corrección" },
      { id: "objetivo", nombre: "glucosa objetivo" },
    ];

    let hayErrores = false;

    // Limpiar errores anteriores
    racionesInput.classList.remove("error");
    document.getElementById("error-raciones").textContent = "";

    fields.forEach(({ id }) => {
      const campo = form[id];
      const errorText = document.getElementById(`error-${id}`);
      campo.classList.remove("error");
      errorText.textContent = "";
    });

    const racionesValor = racionesInput.value.trim();
    const errorRaciones = document.getElementById("error-raciones");
    if (racionesValor && (isNaN(parseFloat(racionesValor)) || parseFloat(racionesValor) < 0)) {
      racionesInput.classList.add("error");
      errorRaciones.textContent = `❌ El valor no es válido. Tiene que ser un número. 😬`;
      hayErrores = true;
    } else if (racionesComidaConfort + racionesTablaHCTotal + getRacionesManuales() <= 0) {
      errorRaciones.textContent = "Elige comida confort, anade alimentos por defecto o escribe raciones extra.";
      hayErrores = true;
    }

    fields.forEach(({ id, nombre }) => {
      const campo = form[id];
      const valor = campo.value.trim();
      const errorText = document.getElementById(`error-${id}`);

      if (!valor) {
        campo.classList.add("error");
      errorText.textContent = `Se te ha pasado rellenar este campo. 😬`;
        hayErrores = true;
      } else if (isNaN(parseFloat(valor))) {
        campo.classList.add("error");
        errorText.textContent = `❌ El valor no es válido. Tiene que ser un número. 😬`;
        hayErrores = true;
      }
    });

    if (hayErrores) {
      //resultadoDiv.textContent = "⚠️ Corrige los errores antes de continuar.";
      return;
    }

    // Cálculos
    const racionesManuales = getRacionesManuales();
    const raciones = racionesComidaConfort + racionesTablaHCTotal + racionesManuales;
    const glucosa = parseFloat(form.glucosa.value);
    const ic = parseFloat(form.relacion.value);
    const fc = parseFloat(form.correccion.value);
    const objetivo = parseFloat(form.objetivo.value);

    const comida = raciones * ic;
    const correccion = Math.max(0, (glucosa - objetivo) / fc);
    const sinRedondear = Math.max(0, comida + correccion);
    const dosisRedondeada = Math.round(sinRedondear * 2) / 2;
    const dosisTotal = dosisRedondeada.toFixed(1);

    resultadoDiv.textContent = `💉 Dosis recomendada: ${dosisTotal} unidades (${formatNumero(raciones)} raciones totales)`;

    // Historial
    const textoRaciones = raciones === 1 ? "ración" : "raciones";
    const entrada = `🍽️ ${formatNumero(raciones)} ${textoRaciones}, 🩸 ${glucosa} mg/dL → 💉 ${dosisTotal}u`;
    historial.unshift(entrada);
    if (historial.length > 5) historial.pop();

    historialDiv.innerHTML = "<h3>Historial</h3><ul>" +
      historial.map(e => `<li>${e}</li>`).join("") + "</ul>";
  });
});
