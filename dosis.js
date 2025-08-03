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

  // Historial en memoria
  const historial = [];

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const carbs = parseFloat(form.carbs.value);
    const glucosa = parseFloat(form.glucosa.value);
    const ic = parseFloat(form.relacion.value);
    const fc = parseFloat(form.correccion.value);
    const objetivo = parseFloat(form.objetivo.value);

    if (isNaN(carbs) || isNaN(glucosa) || isNaN(ic) || isNaN(fc) || isNaN(objetivo)) {
      resultadoDiv.textContent = "⚠️ Completa todos los campos correctamente.";
      return;
    }

    const comida = carbs / ic;
    const correccion = (glucosa - objetivo) / fc;
    const dosisTotal = Math.max(0, comida + correccion).toFixed(2);

    resultadoDiv.textContent = `💉 Dosis recomendada: ${dosisTotal} unidades`;

    // Guardar en historial
    const entrada = `🍽️ ${carbs}g CH, 🩸 ${glucosa} mg/dL → 💉 ${dosisTotal}u`;
    historial.unshift(entrada);
    if (historial.length > 5) historial.pop();

    historialDiv.innerHTML = "<h3>Historial</h3><ul>" +
      historial.map(e => `<li>${e}</li>`).join("") + "</ul>";
  });
});
