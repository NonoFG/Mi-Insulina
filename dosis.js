document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("dosisForm");
  const resultadoDiv = document.getElementById("resultado");
  const historialDiv = document.getElementById("historial");

  const temaRadios = document.querySelectorAll('input[name="tema"]');
  const body = document.body;

  // Cargar tema anterior si existe
  const temaGuardado = localStorage.getItem("tema");
  if (temaGuardado) {
    body.setAttribute("data-tema", temaGuardado);
    document.querySelector(`input[value="${temaGuardado}"]`).checked = true;
  }

  // Cambiar tema manualmente
  temaRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      body.setAttribute("data-tema", radio.value);
      localStorage.setItem("tema", radio.value);
    });
  });
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

  comidaConfortSelect.addEventListener("change", () => {
    const selectedOption = comidaConfortSelect.value;
    let racionesValor = ''; // Deja el valor vacío por defecto

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
      // 'not-this-time' y otras opciones no harán nada, el campo se mantendrá vacío o con el valor que tenga
      default:
        racionesValor = '';
    }
    racionesInput.value = racionesValor;
  });

  // Historial en memoria
  const historial = [];

  // Lógica para seleccionar la comida por la hora
  const horaActual = new Date().getHours();
  const minutosActuales = new Date().getMinutes();

  const getComidaPorHora = (hora, minutos) => {
    // Desayuno: de 03:00 a 12:29
    if ((hora >= 3 && hora < 12) || (hora === 12 && minutos < 30) || (hora >= 0 && hora < 3)) {
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
    // Cena: de 20:00 a 02:59
    if (hora >= 20 || hora < 3) {
      return "cena";
    }
    return "desayuno"; // Valor por defecto
  };


  const comidaPorDefecto = getComidaPorHora(horaActual, minutosActuales);
  const radioComida = document.querySelector(`input[name="comida"][data-comida-nombre="${comidaPorDefecto}"]`);
  if (radioComida) {
    radioComida.checked = true;
  }


  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const fields = [
      { id: "raciones", nombre: "raciones de carbohidratos" },
      { id: "glucosa", nombre: "nivel de glucosa" },
      { id: "relacion", nombre: "índice de insulina" },
      { id: "correccion", nombre: "factor de corrección" },
      { id: "objetivo", nombre: "glucosa objetivo" },
    ];

    let hayErrores = false;

    // Limpiar errores anteriores
    fields.forEach(({ id }) => {
      const campo = form[id];
      const errorText = document.getElementById(`error-${id}`);
      campo.classList.remove("error");
      errorText.textContent = "";
    });

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
    const raciones = parseFloat(form.raciones.value);
    const glucosa = parseFloat(form.glucosa.value);
    const ic = parseFloat(form.relacion.value);
    const fc = parseFloat(form.correccion.value);
    const objetivo = parseFloat(form.objetivo.value);

    const comida = raciones * ic;
    const correccion = Math.max(0, (glucosa - objetivo) / fc);
    const sinRedondear = Math.max(0, comida + correccion);
    const dosisRedondeada = Math.round(sinRedondear * 2) / 2;
    const dosisTotal = dosisRedondeada.toFixed(1);

    resultadoDiv.textContent = `💉 Dosis recomendada: ${dosisTotal} unidades`;

    // Historial
    const textoRaciones = raciones === 1 ? "ración" : "raciones";
    const entrada = `🍽️ ${raciones} ${textoRaciones}, 🩸 ${glucosa} mg/dL → 💉 ${dosisTotal}u`;
    historial.unshift(entrada);
    if (historial.length > 5) historial.pop();

    historialDiv.innerHTML = "<h3>Historial</h3><ul>" +
      historial.map(e => `<li>${e}</li>`).join("") + "</ul>";
  });
});