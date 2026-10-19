# Graph Report - Mi-Insulina  (2026-10-19)

## Corpus Check
- Corpus is ~43,286 words - fits in a single context window. You may not need a graph.

## Summary
- 342 nodes · 764 edges · 23 communities (14 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.85)
- Token cost: not measured. The host-agent tools did not expose semantic token usage; zero counters in intermediate extraction data are placeholders, not evidence of zero cost.

## Community Hubs (Navigation)
- Ajustes y navegación
- ZXing: captura y vídeo
- ZXing: decodificación y geometría
- Escaneo y consulta de productos
- Normalización y función Supabase
- Decisiones, evidencias y seguridad
- Cálculos y borradores
- Catálogo y caché IndexedDB
- Estado y acumuladores de comida
- Búsqueda y presentación nutricional
- Plantillas y validación
- Interfaz y formularios HTML
- Shell offline y credenciales
- Filas de comida y favoritos
- Configuración y pruebas Node
- Esquema de productos escaneados
- Licencia MIT de ZXing
- Icono Android 192
- Icono Android 512
- Icono Apple Touch
- Favicon 16
- Favicon 32

## God Nodes (most connected - your core abstractions)
1. `ui` - 49 edges
2. `numeroFinito()` - 26 edges
3. `recalcularComida()` - 23 edges
4. `renderListaComida()` - 19 edges
5. `normalizeOpenFoodFacts()` - 16 edges
6. `normalizeBarcode()` - 15 edges
7. `ni` - 15 edges
8. `cargarPlantilla()` - 14 edges
9. `calcularAlimento()` - 13 edges
10. `anadirAlimento()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `createHandler()` --calls--> `normalizeBarcode()`  [EXTRACTED]
  supabase/functions/guardar-producto/index.ts → product-data.js
- `createHandler()` --calls--> `ProductDataError`  [EXTRACTED]
  supabase/functions/guardar-producto/index.ts → product-data.js
- `createHandler()` --calls--> `normalizeOpenFoodFacts()`  [EXTRACTED]
  supabase/functions/guardar-producto/index.ts → product-data.js
- `Escaneo ZXing local; consulta nutricional solo por código` --references--> `Licencia incluida de ZXing Library y avisos jai-imageio`  [EXTRACTED]
  BACKLOG.md → vendor/ZXING-LIBRARY-LICENSE.txt
- `leerPlantillas()` --calls--> `migrarComidaGuardada()`  [EXTRACTED]
  dosis.js → calculos.js

## Import Cycles
- None detected.

## Communities (23 total, 9 thin omitted)

### Community 0 - "Ajustes y navegación"
Cohesion: 0.05
Nodes (44): actualizarTema(), actualizarVista(), acumuladorGrasas, acumuladorProteinas, ajustes, botonAjustes, botonCerrarAjustes, botonFavoritoActual (+36 more)

### Community 2 - "ZXing: decodificación y geometría"
Cohesion: 0.08
Nodes (15): a(), constructor(), e(), fi, ii(), li, n(), ni (+7 more)

### Community 3 - "Escaneo y consulta de productos"
Cohesion: 0.17
Nodes (28): abortError(), decodeBarcodePhoto(), drawOrientation(), imageDimensions(), loadImage(), loadZxing(), nextTask(), throwIfAborted() (+20 more)

### Community 4 - "Normalización y función Supabase"
Cohesion: 0.14
Nodes (25): BARCODE_LENGTHS, knownUnit(), MASS_UNITS, normalizeOpenFoodFacts(), numericValue(), nutrient100g(), parseMeasure(), parseMultipack() (+17 more)

### Community 5 - "Decisiones, evidencias y seguridad"
Cohesion: 0.08
Nodes (19): B01: equivalencia configurable de gramos HC por ración, B04: acceso de catálogo observado, controles de seguridad sin certificar, B05: procedencia y revisión nutricional externa pendientes, B07: cierre local de contraste accesible (2026-10-19), Escaneo ZXing local; consulta nutricional solo por código, Backlog de Mi Insulina, Límite de almacenamiento offline del shell y catálogo, Atribución a Open Food Facts y ODbL 1.0 (+11 more)

### Community 6 - "Cálculos y borradores"
Cohesion: 0.21
Nodes (16): calcularAlimento(), calcularComida(), calcularUGP(), CAMPOS, COMIDAS_ANTIGUAS, esSinHidratos(), getDatoNutricional(), getGramosPorRacionDeAlimento() (+8 more)

### Community 7 - "Catálogo y caché IndexedDB"
Cohesion: 0.20
Nodes (11): abrirBaseDeDatos(), cargarAlimentosCompletos(), detalleHttp(), errorDeCarga(), guardarCatalogo(), informar(), interpretarRango(), leerCatalogoGuardado() (+3 more)

### Community 8 - "Estado y acumuladores de comida"
Cohesion: 0.25
Nodes (18): agregarHidratosManuales(), anadirAlimento(), cargarPlantilla(), cerrarOpciones(), clone(), crearAcumulador(), anadir(), render() (+10 more)

### Community 9 - "Búsqueda y presentación nutricional"
Cohesion: 0.23
Nodes (16): nombreAlimento(), actualizarEstadoCatalogo(), alimentoExacto(), buscarAlimentos(), cargarCatalogo(), cargarProductosGuardados(), datosProcedencia(), etiquetaAlimento() (+8 more)

### Community 10 - "Plantillas y validación"
Cohesion: 0.36
Nodes (10): abrirAjustes(), anadirHidratosManuales(), borrarError(), eliminarPlantilla(), guardarJson(), guardarPlantilla(), leerExtra(), leerPlantillas() (+2 more)

### Community 11 - "Interfaz y formularios HTML"
Cohesion: 0.22
Nodes (7): Documento HTML de entrada de Mi Insulina, Vista Gramos → Raciones y búsqueda de alimentos HC, Entrada manual por 100 g y cantidades exactas, Open Food Facts: atribución visible y licencia ODbL, Dato nutricional vacío significa desconocido, no cero, Escáner: foto local, consulta de código y revisión editable, Ajustes de equivalencia, energía y cálculo informativo UGP

### Community 12 - "Shell offline y credenciales"
Cohesion: 0.33
Nodes (4): CREDENTIAL_HEADERS, getShellAssets(), precacheShell(), SHELL_FILES

### Community 13 - "Filas de comida y favoritos"
Cohesion: 0.53
Nodes (6): actualizarDetalleFila(), idAlimento(), leerJson(), renderListaComida(), toggleFavorito(), unidadCantidad()

### Community 14 - "Configuración y pruebas Node"
Cohesion: 0.33
Nodes (5): name, private, scripts, test, type

## Knowledge Gaps
- **27 isolated node(s):** `B01: equivalencia configurable de gramos HC por ración`, `Resumen único de la comida con desglose por entrada`, `B05: procedencia y revisión nutricional externa pendientes`, `B07: cierre local de contraste accesible (2026-10-19)`, `Límite de almacenamiento offline del shell y catálogo` (+22 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 107 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ui` connect `ZXing: captura y vídeo` to `ZXing: decodificación y geometría`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `B01: equivalencia configurable de gramos HC por ración`, `Resumen único de la comida con desglose por entrada`, `B05: procedencia y revisión nutricional externa pendientes` to the rest of the system?**
  _27 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Ajustes y navegación` be split into smaller, more focused modules?**
  _Cohesion score 0.04995374653098982 - nodes in this community are weakly interconnected._
- **Why does `initProductScanner()` connect `Escaneo y consulta de productos` to `Ajustes y navegación`, `Cálculos y borradores`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `ZXing: captura y vídeo` be split into smaller, more focused modules?**
  _Cohesion score 0.10545790934320073 - nodes in this community are weakly interconnected._
- **Why does `normalizeBarcode()` connect `Escaneo y consulta de productos` to `Normalización y función Supabase`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `ZXing: decodificación y geometría` be split into smaller, more focused modules?**
  _Cohesion score 0.0797979797979798 - nodes in this community are weakly interconnected._

## Alcance, integridad y verificación de esta ejecución

- Alcance aprobado: únicamente `Mi-Insulina`. No se incorporaron los demás proyectos ni los PDF «Tratamiento…» de `FincApp`.
- Corpus soportado: 18 archivos de código, 5 documentos y 5 imágenes. Se extrajo código mediante AST local, y documentación e imágenes mediante los agentes de esta sesión; no se usó una API LLM adicional ni se publicaron resultados.
- Graphify no clasificó `main.css`, `site.webmanifest`, `supabase/.temp/cli-latest`, `supabase/config.toml` ni `supabase/deploy.env`. Sus contenidos no están representados por un análisis propio del archivo.
- `audit-supabase.ps1` solo aparece como nodo de archivo: el extractor no produjo símbolos internos. En el favicon de 16×16 no se pudieron resolver con confianza todos los detalles visuales.
- Grafo no dirigido por defecto. El diagnóstico detectó 48 relaciones entre los mismos pares que colapsan al construir el grafo simple y 6 autorreferencias. No detectó extremos ausentes ni colgantes. Los caminos del grafo no deben interpretarse por sí solos como dirección causal de llamadas.
- El diagnóstico completo de la extracción se conserva en `graph-health.json`; sus recuentos de entrada corresponden a la extracción previa a la construcción del grafo.
- Verificación CLI: consulta de los bloqueos B04/B05 y explicación de `calcularAlimento()`. B04/B05 siguen descritos como pendientes, no como seguridad de producción ni nutrición certificadas.
- Verificación visual en Chromium a 1440×1000: grafo renderizado, búsqueda de `calcularAlimento()`, selección con ficha y 13 vecinos, y cambio entre tema oscuro y claro; sin errores JavaScript observados.
- El benchmark de Graphify estima 9,1 veces menos tokens por consulta en su muestra. Es una estimación de recuperación de contexto, no una medición del consumo ni del coste de esta ejecución.
- `graphify-out/` se ha generado dentro del árbol de trabajo del repositorio. Puede excluirse mediante `.gitignore` si no se desea versionar. No se hizo push, despliegue ni escritura en Supabase.
