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

    const fields = ["raciones", "glucosa", "relacion", "correccion", "objetivo"];
    let hayErrores = false;

    // Limpiar errores anteriores
    fields.forEach(id => {
      const campo = form[id];
      campo.classList.remove("error");
      if (!campo.value || isNaN(parseFloat(campo.value))) {
        campo.classList.add("error");
        hayErrores = true;
      }
    });

    if (hayErrores) {
      resultadoDiv.textContent = "⚠️ Completa todos los campos correctamente.";
      return;
    }

    const raciones = parseFloat(form.raciones.value);
    const glucosa = parseFloat(form.glucosa.value);
    const ic = parseFloat(form.relacion.value);
    const fc = parseFloat(form.correccion.value);
    const objetivo = parseFloat(form.objetivo.value);

    const comida = raciones * ic;
    const correccion = (glucosa - objetivo) / fc;
    const sinRedondear = Math.max(0, comida + correccion);
    const dosisRedondeada = Math.round(sinRedondear * 2) / 2;
    const dosisTotal = dosisRedondeada.toFixed(1);

    resultadoDiv.textContent = `💉 Dosis recomendada: ${dosisTotal} unidades`;

    // Guardar en historial
    const entrada = `🍽️ ${raciones}g CH, 🩸 ${glucosa} mg/dL → 💉 ${dosisTotal}u`;
    historial.unshift(entrada);
    if (historial.length > 5) historial.pop();

    historialDiv.innerHTML = "<h3>Historial</h3><ul>" +
      historial.map(e => `<li>${e}</li>`).join("") + "</ul>";
  });
});
