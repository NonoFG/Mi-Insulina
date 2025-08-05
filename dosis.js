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
  // NUEVO: Manejar el selector de comida para actualizar la relación I/C
  const comidaRadios = document.querySelectorAll('input[name="comida"]');
  const relacionInput = document.getElementById("relacion");

  comidaRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      relacionInput.value = radio.value;
    });
  });
  // Historial en memoria
  const historial = [];

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