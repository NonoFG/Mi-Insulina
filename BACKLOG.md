# Backlog de Mi Insulina

## Estado de ejecución

Implementación integrada y verificada en navegador real. **13 elementos completados; B04 y B05 no cumplen todavía toda su aceptación por requisitos externos ausentes.** No se ha desplegado en un servidor remoto ni modificado la base de datos de producción.

Se mantiene Comida confort, Alimentos HC y Raciones extra en **Gramos → Raciones**. No hay pantalla, cálculo ni botones de dosis de insulina.

## Decisión sobre P0.0 / B01

El usuario eligió **equivalencia configurable**, inicialmente 10 g HC/ración. Todos los resultados usan los mismos gramos HC canónicos. Cambiar la equivalencia conserva los gramos de alimento y los gramos HC, y recalcula las raciones. Las raciones extra se convierten a gramos HC al introducirlas, con la equivalencia vigente; posteriormente también conservan esos HC.

Los valores antiguos de confort se conservan como 52,9 / 14,7 / 86,3 g HC, referidos a la equivalencia histórica de 10 g HC/ración. Esto conserva los datos originales, no acredita su exactitud nutricional.

## Elementos y aceptación

| ID | Prioridad | Estado | Resultado / aceptación |
| --- | --- | --- | --- |
| B01 | P0 | Completado | Equivalencia configurable única para catálogo, confort, entradas manuales y extras. Ajustes recalcula raciones sin cambiar HC. |
| B02 | P0 | Completado | Un resumen único con desglose por entrada. Se eliminó el envío duplicado de alimentos a otro acumulador; las entradas manuales HC se añaden a la misma comida. |
| B03 | P0 | Completado | Errores junto a cantidades, porciones, extras y ajustes. Un dato inválido de la comida impide presentar un total parcial como completo. Cero/vacío tienen ayuda explícita. |
| B04 | P0 | Bloqueado parcialmente | Lectura pública del catálogo auditada mediante GET. RLS, grants, denegación de escrituras y lecturas privadas no están certificados. Ver `SECURITY_AUDIT.txt`. |
| B05 | P0 | Bloqueado parcialmente | Cero y desconocido se distinguen. Se muestran fuente/fecha/estado si existen, y ausencia explícita si no. Crudo/hervido/cocido se identifica a partir del nombre cuando este lo indica, marcando esa procedencia. Faltan fuentes nutricionales externas y fechas reales para acreditar cada equivalencia. |
| B06 | P1 | Completado | Gramos de cada entrada y porciones de comida confort editables, con recálculo inmediato. |
| B07 | P1 | Completado | Etiquetas, búsqueda con flechas/Enter/Escape, foco contenido y devuelto por el modal y estados accesibles conservados. Contraste corregido en los textos y controles revisados del tema claro, con aprobación del usuario; botones pastel y colores del tema oscuro conservados. Ver cierre y límites de verificación al final. |
| B08 | P1 | Completado | Borrador local persistente. Reinicio con confirmación conserva ajustes, favoritos y plantillas. |
| B09 | P1 | Completado | Catálogo paginado íntegro, error/reintento/reconexión y copia IndexedDB con fecha. Se avisa si no se pudo guardar una copia offline. Fallos no borran la comida. |
| B10 | P1 | Completado | Regresiones permanentes de equivalencia, cantidades, desconocidos/cero, edición y paginación incompleta/repetida. Ejecutar `npm test`. |
| B11 | P2 | Completado | Favoritos y plantillas locales; recuperar una plantilla crea una copia editable sin modificar el original. |
| B12 | P2 | Completado | Service worker para shell offline, catálogo guardado con antigüedad visible y manifiesto instalable con rutas relativas. |
| B13 | P2 | Completado | Tema claro/oscuro persistente y automático según la preferencia del sistema. Controles en español. |
| B14 | P1 | Completado | Escaneo directo con vista previa, activación explícita y cierre tras el primer código válido. Conserva foto/código manual y revisión antes de aceptar. Permisos, cancelación y liberación de cámara comprobados en Chromium con dispositivos simulados; teléfono físico pendiente de certificación. |
| B15 | P1 | Completado | Alimentos HC organizado en campos alineados, acciones agrupadas, favoritos, comida y plantillas. Controles principales de 48 px, anchos coherentes y disposición apilada en móvil. Interacciones y ausencia de desbordamiento verificadas entre 320 y 1440 px. |

## Requisitos externos para cerrar B04 y B05

- **B04:** acceso administrativo de solo lectura a los metadatos PostgreSQL de políticas/grants/RLS, o resultados de las consultas de `SECURITY_AUDIT.txt`; inventario confirmado de relaciones privadas. Las pruebas de denegación que impliquen mutaciones deben hacerse en un entorno de pruebas autorizado, no sobre producción. No colocar credenciales administrativas ni `service_role` en el cliente.
- **B05:** referencias nutricionales reales por alimento y producto confort, con marca/preparación cuando proceda y fecha de revisión. Los datos actuales no permiten inventarlas ni atribuirlos a una tabla externa por similitud. La fecha de descarga del catálogo **no** es una fecha de revisión nutricional.

## Uso y publicación

- Aplicación estática, sin dependencias npm que instalar.
- `npm test` ejecuta las regresiones con Node.js.
- Servir por HTTP en localhost o HTTPS en publicación; no abrir directamente `index.html` con `file://`.
- El servidor debe entregar `.js` como JavaScript (`application/javascript` o `text/javascript`). El módulo del cliente se publica como `calculos.js` para evitar el MIME `text/plain` observado con `.mjs` en el servidor Python de este equipo.
- Publicar también `calculos.js`, `catalog.js`, `supabase-config.js`, `product-data.js`, `products.js`, `barcode.js`, `scan-product.js`, `vendor/` con sus licencias, `sw.js`, manifiesto, CSS e iconos. El service worker solo guarda el shell same-origin, no respuestas de Supabase con credenciales. El catálogo habitual se guarda explícitamente en IndexedDB.
- Favoritos, borrador, plantillas y ajustes son locales al navegador/dispositivo; no se sincronizan con Supabase.

## Verificación ejercitada

- `npm test`: **10 pruebas correctas**, sin fallos.
- Navegador móvil de 390 px y escritorio de 1280 px, con comprobación visual; sin desbordamiento horizontal en el escenario móvil.
- Reproducción previa de B01: con equivalencia 20 g/ración, confort seguía mostrando 5,29 raciones mientras el conversor de los mismos 52,9 g HC mostraba 2,65.
- Tras la implementación: 52,9 g HC de confort + 20 g HC de arroz + 20 g HC extra + 10 g HC manuales = 102,9 g HC. Al cambiar de 10 a 20 g/ración se conservan 102,9 g HC y las extras pasan de 2 a 1 ración.
- Edición: dos porciones de confort y arroz hervido de 152 g producen 175,8 g HC y 8,79 raciones a 20 g/ración. Entrada manual de 40 g de alimento con 25 g HC/100 g añade 10 g HC, una sola vez.
- Cantidades negativas y equivalencia cero muestran errores; cero explícito de composición aporta cero. UGP manual: 10 g grasa + 10 g proteína = 130 kcal y 0,87 UGP con los factores iniciales.
- Favorito y borrador conservados tras recarga. Plantilla recuperada mantiene el original; cancelar reinicio conserva la comida y aceptar reinicio conserva ajustes/guardados.
- Búsqueda con flechas/Enter/Escape y modal con Tab/Shift+Tab/Escape, devolución de foco comprobada. En el diseño anterior a la recuperación de la paleta original se midieron mínimos de contraste 6,01:1 claro y 6,85:1 oscuro; esas cifras no describen el diseño pastel actual.
- Catálogo real: **146 alimentos**. Regresión de 2500 filas con un servidor simulado que limita cada página a 700: offsets 0, 700, 1400 y 2100, sin truncamiento.
- Recarga offline funciona con shell y catálogo guardados; muestra fecha y advertencia de antigüedad. Reintento/reconexión recupera datos sin alterar la comida. Sin copia local, error accionable y comida conservada.
- Chromium informó **cero errores de manifiesto y de instalabilidad**. Se verificó también publicación bajo `/Mi-Insulina/`, con scope relativo y recarga offline. No se instaló la app en un teléfono físico.
- Inicio limpio en escritorio sin errores JavaScript.

## Recuperación del diseño personal

- Verde original `#7EC384`, fondo claro `#f9f9f9` y oscuro `#222222`, campos de 12 px de radio y ancho máximo de 500 px.
- Se retiró la presentación de grandes tarjetas con sombras; se recuperó una composición sencilla como la original.
- Cabecera «Calculadora de raciones para mi novia» y pie «Para ti, bombón», manteniendo el apartado Gramos → Raciones y sin pantalla de dosis.
- Los botones verdes usan texto oscuro para conservar legibilidad; los títulos recuperan el verde pastel original.
- Verificado visualmente en móvil de 390 px y escritorio de 1280 px, con temas claro y oscuro, sin desbordamiento horizontal ni errores JavaScript.
- Comprobado que el cambio visual conserva el cálculo de comida: 52,9 g HC de confort + 20 g manuales + 20 g extra = 92,9 g HC / 9,29 raciones; modal de ajustes conserva devolución de foco.
- Manifiesto actualizado con los colores personales y caché del shell incrementada a v3 para renovar el diseño guardado.


## Entrada adicional de cantidades exactas

- En **Añadir manualmente**, «Añadir hidratos exactos» permite introducir los gramos HC totales de la bebida, producto o porción consumida, sin indicar peso ni composición por 100 g.
- En el mismo apartado, grasas y proteínas conservan sus formularios por 100 g y sus entradas exactas. Las cantidades directas se suman a la comida y al cálculo informativo de UGP y se pueden quitar individualmente.
- Los nuevos campos son independientes de los valores pendientes en los formularios por 100 g. Admiten decimales y cero; vacío, valores negativos o no numéricos no añaden entradas y muestran un error accesible. Se puede añadir con el botón o con Enter.
- Los hidratos directos usan las entradas de comida existentes: se conservan en el borrador y en las plantillas, y su cantidad de HC no cambia al modificar la equivalencia. En el detalle se identifican como gramos HC directos, no como gramos de alimento.
- Los acumuladores manuales de grasas y proteínas forman parte del estado global de la comida y se conservan en el borrador y en las plantillas. Los productos escaneados y aceptados también contribuyen a UGP, sin copiarse a estos acumuladores. No se calcula ninguna dosis de insulina.
- Caché del shell incrementada a **v4** para actualizar la aplicación instalada.
- Verificación en navegador real: 40 g de alimento con 25 g HC/100 g + 18,5 g HC directos = **28,5 g HC**; al cambiar de 10 a 20 g HC/ración se conservan los HC, también tras recargar. Editar la entrada directa a 22,75 g produce **32,75 g HC**.
- Verificación UGP: 10 g de grasas calculados por peso + 6,2 g directos y 8 g de proteínas calculados por peso + 4,8 g directos = **197 kcal / 1,31 UGP**. Quitar las dos cantidades directas deja **122 kcal / 0,81 UGP**.
- Comprobados botón/Enter, errores de vacío/negativos, aceptación de cero y conservación de los campos por 100 g. Inspección visual a 390 px en tema oscuro y a 1280 px en tema claro, sin desbordamiento horizontal ni errores JavaScript.
- Verificada la recuperación de una copia editable de plantilla sin alterar el original y la eliminación de HC directos. Recarga sin conexión con shell v4: añadir 1,25 g HC directos a 10 g HC conserva el cálculo (**11,25 g HC / 0,56 raciones** con equivalencia 20); los tres formularios siguen disponibles.


## Escaneo de códigos de barras y productos guardados

### Uso

- En el apartado independiente **Escanear producto**, pulsar **Activar cámara** y enfocar el código para leerlo sin tomar una foto. La cámara se apaga al detectar el primer código válido y se abre la revisión del producto. También se puede hacer una foto, elegir una imagen o escribir el código. Se admiten EAN-8, UPC-A, EAN-13 y GTIN-14 con dígito de control válido.
- El vídeo y las fotos se decodifican localmente con ZXing, sin subirlos a Supabase ni a Open Food Facts. La consulta nutricional usa únicamente el código. El bundle fijado de ZXing y sus licencias se distribuyen en `vendor/`; no depende de un lector nativo disponible solo en algunos navegadores.
- La cámara directa necesita permiso del navegador y un contexto seguro: HTTPS en publicación o localhost para desarrollo. Una dirección HTTP de la red local no basta. Si no hay acceso a cámara, las opciones de foto y código manual siguen disponibles.
- La revisión muestra los tres nutrientes por 100 g o 100 ml y la cantidad propuesta. Se prioriza la porción conocida o una unidad del multipack; si solo se conoce un envase individual, se propone su contenido con aviso para ajustarlo. No se inventa una cantidad cuando falta y nunca se convierten mililitros a gramos suponiendo densidad.
- Consultar, editar, guardar o descartar **no añade nutrientes a la comida**. Solo «Aceptar y añadir a la comida y UGP» crea una entrada y vuelve a **Gramos → Raciones**, con la fila añadida enfocada y desplazada a la vista. Se puede revisar y cambiar el nombre, los nutrientes y la cantidad antes de aceptar.
- Las grasas y proteínas de productos confirmados se calculan desde las mismas entradas de comida; no se copian a los acumuladores manuales. Editar cantidad, quitar la entrada o recuperar el borrador mantiene sincronizados HC, macros y UGP. Los alimentos habituales y las entradas manuales anteriores mantienen su comportamiento.
- Vacío significa desconocido; cero explícito significa cero. HC y cantidad son necesarios para aceptar. Si falta grasa o proteína, se conserva esa ausencia y no se presenta una UGP parcial como completa.
- «Guardar ficha original en la BD» es independiente de aceptar. Conserva la ficha original de Open Food Facts y evita duplicados por código; las correcciones de la revisión se aplican solo a la comida. Los productos guardados y favoritos se recuperan en la búsqueda habitual y abren su revisión en **Escanear producto**, sin añadir hasta la aceptación.
- El catálogo de productos es público y compartido, como el catálogo habitual; no contiene fotos ni registros privados de consumo. La comida, ajustes, favoritos y plantillas siguen siendo locales.
- Los datos proceden de una base colaborativa: hay que comprobar la etiqueta. Se muestra atribución a [Open Food Facts](https://world.openfoodfacts.org/) y [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). La fecha de consulta no acredita una revisión nutricional.

### Activación del guardado remoto

El código cliente, la función y la migración están implementados. **Publicación aplazada por decisión del usuario: revisar primero en `http://127.0.0.1:3000/index.html?vscode-livepreview=true`, sin push, despliegue ni cambios en la BD remota.** El escaneo, la consulta y la revisión de nutrientes se pueden probar en local sin acceso administrativo.

La configuración pública para un futuro despliegue está en `supabase/deploy.env`: origen `https://nonofg.github.io` (sin `/Mi-Insulina/`) y User-Agent identificado con la URL real de la aplicación. No contiene credenciales y no se ha enviado a Supabase.

Cuando se autorice publicar, seguirá siendo necesario resolver el acceso administrativo al proyecto `ncyzseuzetwgeluptqdl`: la sesión CLI comprobada devuelve **HTTP 403 por permisos insuficientes**. No se ha aplicado la migración ni desplegado la función, ni se ha cambiado a otra BD. La aplicación no finge un guardado remoto cuando el servicio no está disponible.

1. Con acceso del propietario a Supabase, aplicar `supabase/migrations/20261016000000_productos_escaneados.sql`. Puede ejecutarse desde el SQL Editor. Si se usa CLI, revisar primero la vinculación y el historial antes de `db push`:

   ```powershell
   npx supabase login
   npx supabase link --project-ref ncyzseuzetwgeluptqdl
   npx supabase db push --dry-run
   npx supabase db push
   ```

2. En Supabase debe existir una clave secreta del servidor denominada `default`, inyectada por el runtime en `SUPABASE_SECRET_KEYS`. Nunca ponerla en `supabase-config.js` ni en otro recurso publicado. La función usa esta clave mediante `apikey`; el cliente solo usa la clave publicable.
3. La configuración pública ya preparada en `supabase/deploy.env` fija `APP_ORIGIN=https://nonofg.github.io` y `OFF_USER_AGENT` con la URL real de Mi Insulina. El origen no incluye la ruta de GitHub Pages. Para probar una función local por separado, su origen permitido debe ser el localhost exacto de esa prueba. No añadir claves ni credenciales a este archivo.

   ```powershell
   npx supabase secrets set --project-ref ncyzseuzetwgeluptqdl --env-file supabase/deploy.env
   npx supabase functions deploy guardar-producto --project-ref ncyzseuzetwgeluptqdl --no-verify-jwt
   ```

4. Solo después de aprobar la revisión local, publicar los recursos del cliente indicados arriba bajo HTTPS para el móvil. El shell se actualiza a **v6**. El lector local está en la caché, pero consultar nuevos productos y guardar en Supabase requieren conexión.

La función solo admite un código válido y obtiene los datos de Open Food Facts en el servidor; no acepta nutrientes arbitrarios del cliente. La tabla nueva tiene RLS, lectura pública y permisos de inserción solo para el rol de servidor, sin permisos públicos de actualización o borrado. `APP_ORIGIN` restringe el uso desde navegadores, **no es autenticación**: clientes HTTP externos pueden imitar ese origen. El endpoint es una importación pública de fichas nutricionales públicas, no un guardado privado por usuario.

Referencia de integración: [API de Open Food Facts](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/), [esquema de productos y cantidades](https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product/) y [claves de Supabase](https://supabase.com/docs/guides/getting-started/api-keys). La API puede limitar consultas y el navegador no puede establecer un User-Agent propio; el guardado de servidor sí usa el configurado. No se ha dado de alta la aplicación en el formulario de uso del proveedor ni inventado un contacto.

### Verificación del escaneo

- `npm test`: **20 pruebas correctas**, incluidas validación de código, cero/desconocido, porciones, multipacks, envase individual de 125 g y unidades de volumen. Comprobación de sintaxis de los módulos del cliente correcta.
- Navegador Chromium con imagen EAN real generada y su versión girada: se lee `5901234123457`, se rellenan 12/3/4 g por 100 g y 125 g de consumo; la vista previa indica 15 g HC, 3,75 g de grasa y 5 g de proteína, mientras la comida y UGP siguen vacías.
- Flujo aislado con la función real y PostgreSQL PGlite: guardar persiste la ficha original con 12 g HC/100 g incluso si la revisión está editada a 16; no añade comida. Repetir el código deja una fila; nutrientes enviados por el cliente se rechazan con HTTP 400; una inserción anónima real se deniega con HTTP 403.
- Aceptar la revisión editada a 16 g HC/100 g y 125 g produce 20 g HC y 53,75 kcal / 0,36 UGP. Editar la comida a 250 g produce 40 g HC y 107,5 kcal / 0,72 UGP; la recarga conserva ambos. Quitar la entrada elimina sus tres nutrientes.
- Reutilizar el producto guardado recupera la ficha original y los 125 g, sin sumar hasta la aceptación. Imagen sin código, dígito de control inválido y descarte no añaden entradas.
- Bebida de 250 ml con 4 g HC/100 ml produce 10 g HC y UGP cero cuando grasas/proteínas son cero conocidos; se mantiene `ml` en la cantidad editable. Un producto con grasa desconocida conserva el campo vacío y bloquea el total UGP completo.
- Inspección visual en 390 px (oscuro) y 1280 px (claro), sin desbordamiento horizontal ni errores JavaScript. Caché v5 con el lector local comprobada.
- Las fichas del recorrido de guardado son fixtures aisladas, no datos nutricionales acreditados; no se escribieron productos de prueba en producción. Se realizó además una consulta de lectura a la API de desarrollo de Open Food Facts.
- **Límites:** no se ha certificado una foto tomada con un teléfono físico ni el despliegue/guardado en Supabase remoto. La seguridad verificada de la tabla nueva es la del entorno aislado; no cierra los bloqueos históricos B04/B05 del catálogo anterior.


### Revisión local y corrección del contrato nutricional

- Live Preview comprobado en la URL local del usuario. La publicación de GitHub Pages todavía muestra la versión anterior, por decisión del usuario; no se ha hecho push.
- La consulta real detectó que API v3.6 devuelve `nutriments: {}` para `3017620422003` y `5449000000996`, mientras que v3.4 devuelve los nutrientes normalizados. El [historial oficial](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/ref-api-and-product-schema-change-log/) documenta el cambio de estructura nutricional desde v3.5.
- `products.js` y la función `guardar-producto` quedan fijados a **API v3.4**, cuyo contrato conserva los campos `*_100g` que utiliza la aplicación. No se han inventado nutrientes ni añadido una segunda consulta de respaldo; ambas rutas usan el mismo contrato compatible.
- Consulta real en Live Preview de `3017620422003`: se rellenan 57,5 g HC, 30,9 g de grasa y 6,3 g de proteína por 100 g. Editar la cantidad a 15 g muestra 8,63 g HC, 4,64 g de grasa y 0,95 g de proteína como vista previa; la comida permanece en **0 g HC**, pendiente de aceptación.
- Función recién cargada probada con esa misma fuente real y una BD PostgreSQL/PGlite aislada: HTTP 201 y persistencia de los tres nutrientes correctos, sin escrituras remotas. Sintaxis de cliente, función y service worker comprobada.
- `supabase/deploy.env` validado con la función: preflight del origen GitHub Pages HTTP 204 con `Access-Control-Allow-Origin` correcto; otro origen recibe HTTP 403. Esta comprobación no desplegó nada.


## Diseño adaptable y escáner independiente

- Trabajo exclusivamente local, sin push ni despliegue. Revisar en `http://127.0.0.1:3000/index.html?vscode-livepreview=true`.
- El contenedor deja de limitar toda la web a 500 px y aprovecha hasta 1280 px. Comida, entrada manual y escáner utilizan el ancho de su vista; los formularios manuales se distribuyen en columnas adaptables o se apilan en móvil, sin panel lateral fijo. Se conserva la paleta personal.
- «Alimentos de esta comida» utiliza todo el ancho de la vista, sin quedar comprimido dentro de la columna del formulario de búsqueda. Nombre y cantidad tienen su espacio; hidratos, raciones, grasas y proteínas se muestran separados, en cuatro columnas de escritorio o dos en móvil.
- Los valores de nutrientes usan 18,4 px y los botones de las filas tienen al menos 44 px de alto. Composición y procedencia siguen disponibles en un desplegable con texto de 15,2 px, en vez de mezclarse con los resultados en un párrafo pequeño.
- La navegación separa `#comida`, `#manual` y `#escaner`; la cámara y el código no están dentro de Gramos → Raciones. Al aceptar un producto, se actualiza la comida, se vuelve a Gramos → Raciones y se enfoca/desplaza la entrada nueva. Cambiar de vista no añade ni elimina entradas; Atrás/Adelante recuperan la vista correspondiente.
- Verificado en Live Preview a 320, 390, 768, 1100 y 1440 px, sin desbordamiento horizontal. Inspección visual en claro y oscuro con nombres largos, cantidades editables, nutrientes conocidos/cero/desconocidos y procedencia desplegable por teclado.
- Consulta real y aceptación de Nutella: 15 g producen 8,63 g HC; editar a 20 g muestra 11,5 g HC, 6,18 g de grasa y 1,26 g de proteína. Consulta real y aceptación móvil de 100 ml de Coca-Cola: 10,6 g HC y grasas/proteínas cero. El retorno deja la última fila visible y enfocada en escritorio y móvil.
- Foto comprobada con una imagen EAN generada y ficha nutricional de prueba aislada: se preparan 125 g, no se suma durante la revisión y, al aceptar, se añaden 15 g HC, 3,75 g de grasa y 5 g de proteína una sola vez, volviendo a la fila visible en móvil. No es una certificación de cámara física ni un dato nutricional real acreditado.
- Cantidad negativa: los resultados de la fila se limpian a «—», se marca el error accesible y no se presenta un total parcial. Cero y desconocido siguen distinguiéndose; los HC directos muestran «Sin dato» para macros no aportados. Elegir un producto favorito abre su revisión, sin sumar.
- Sintaxis de `dosis.js`, `scan-product.js` y `sw.js` comprobada; sin errores JavaScript durante los escenarios ejercitados. No se han cambiado las fórmulas de cálculo. Shell actualizado a **v12** para renovar la interfaz guardada; activación observada en el navegador local.

- Los hidratos manuales y exactos comparten recuadro y reutilizan las clases de grasas/proteínas (`nutriente-manual` y `entrada-exacta`) en Añadir manualmente. «Tus comidas guardadas» permanece en Gramos → Raciones.
- Ambos modos de hidratos verificados: 25 g HC/100 g con 40 g de alimento y 7,5 g directos aportan 17,5 g HC, sin duplicados. Misma presentación de borde, espaciado, títulos y subapartado exacto que grasas/proteínas.

## Menú manual y resumen global

- Añadir manualmente reúne los formularios por 100 g, las cantidades exactas de HC/grasas/proteínas, las raciones extra y el cálculo informativo de UGP.
- «Tu comida, de un vistazo» es un único panel compartido, situado como último elemento del contenido principal y visible en los tres apartados. Incluye las aportaciones manuales de grasas y proteínas, manteniendo la distinción entre cero y nutrientes desconocidos de otros alimentos.
- `grasasManuales` y `proteinasManuales` se guardan junto con el resto de la comida. Verificados recarga, eliminación individual persistente, copia editable de plantillas y reinicio completo. También se puede guardar una comida que solo contiene grasas manuales. Las confirmaciones de carga/reinicio se aceptaron mediante automatización.
- Comida confort muestra la equivalencia HC/ración vigente del usuario. Verificado: 52,9 g HC producen 5,29 raciones con 10 g HC/ración y 2,65 con 20; dos porciones conservan 105,8 g HC. Cambiar la equivalencia no altera los HC guardados, incluidas las raciones extra.
- Prueba combinada: confort + 10 g HC por peso + 7,5 g HC directos + 20 g HC extra = 90,4 g HC y 4,52 raciones con equivalencia 20. Añadir 7 g de grasas y 8 g de proteínas produce 95 kcal / 0,63 UGP y aparece igual al cambiar entre los tres menús y al recargar.
- Consulta real de Nutella: preparar 15 g no modifica el resumen; aceptar vuelve a Gramos → Raciones y actualiza la comida anterior a 99,03 g HC, con 11,64 g de grasas conocidas y 8,95 g de proteínas conocidas, sin duplicar las aportaciones manuales. No se pulsó el guardado remoto.
- Verificados los tres apartados a 320, 390, 768, 1100 y 1440 px, siempre con un único resumen al final y sin desbordamiento horizontal. Inspección visual en escritorio y móvil, en claro y oscuro; sin errores JavaScript en los recorridos ejercitados.


## Campos obligatorios en la entrada por 100 g

- Para añadir hidratos, grasas o proteínas por 100 g son obligatorios tanto el valor del nutriente como la cantidad de alimento en gramos. Un campo superior vacío ya no convierte la cantidad en gramos directos.
- Eliminados la explicación de ese modo, «opcional» en las etiquetas y los textos «Vacío = cantidad directa». Las cantidades directas se introducen únicamente en los formularios exactos, independientes de los campos por 100 g pendientes.
- Verificado en los tres nutrientes: falta de cantidad, falta del valor por 100 g y números negativos no modifican la comida. 25 g por 100 g con 40 g de alimento aportan 10 g; añadir 1,5 g exactos deja 11,5 g aunque falte cantidad en el formulario superior. Se conservan el cero explícito y los campos pendientes.
- Inspección visual a 1440 y 390 px, sin desbordamiento móvil ni errores JavaScript. Sintaxis de los módulos modificados correcta y shell v12 activado. Trabajo local, sin push ni escrituras remotas.

## Cierre de B07: contraste accesible — 2026-10-19

- El usuario aprobó ajustar textos y contornos del tema claro manteniendo el verde pastel en botones y acentos y conservando el tema oscuro. No se han modificado cálculos ni datos nutricionales.
- `main.css` reutiliza el verde de texto existente (`#397842`) mediante `--acento-contraste` para los títulos, los contornos de botones/navegación y el radio seleccionado. Los campos claros usan ese mismo verde en `--borde`. El tema oscuro, incluido el automático con preferencia oscura, conserva los colores anteriores.

| Títulos de la página sobre el fondo del tema | Antes | Después |
| --- | --- | --- |
| Claro (`#f9f9f9`) | 1,99:1 | 5,06:1 |
| Oscuro (`#222222`) | 7,60:1 | 7,60:1 |

- Medición adicional en el modal claro: títulos, borde de campos y acento del radio seleccionado alcanzan 5,33:1 sobre blanco. El texto de los botones pastel alcanza 6,40:1. Los estados de error y el foco visible se conservan.
- Navegador Chromium con axe-core 4.13.0: sin infracciones automáticas en comida, entrada manual y revisión de un producto real, en los recorridos claros/oscuros ejercitados. El modal y el autocompletado tuvieron comprobaciones inconclusas de la herramienta; se complementaron con mediciones de estilos y comprobación por teclado. Esto no constituye una certificación WCAG completa ni una prueba con lector de pantalla.
- Comprobados flechas/Enter/Escape en la búsqueda; Tab y Shift+Tab circulares en el modal; Escape cierra y devuelve el foco a Ajustes. Composición/procedencia se puede desplegar sin alterar la comida.
- Smoke de cálculo: 40 g de alimento con 25 g HC/100 g y 7,5 g HC directos mantienen 17,5 g HC / 1,75 raciones. Añadir 6,2 g de grasa y 4,8 g de proteína produce 75 kcal / 0,5 UGP. Una cantidad negativa no añade entradas. Consultar Nutella abre la revisión sin cambiar ese total; no se guardó ni aceptó el producto.
- Inspección visual en escritorio de 1280 px y móvil de 390 px; manual también comprobado a 320 px, sin desbordamiento en las vistas medidas. Verificado el cambio de preferencia del sistema en modo automático.
- Shell actualizado a **v14**, activación y recarga offline observadas: conserva la comida, los ajustes y el contraste nuevo. En offline solo se observaron los fallos de red esperados de fuentes y Supabase, sin excepciones JavaScript de la aplicación.
- **B04 y B05 siguen parcialmente bloqueados** por los requisitos externos indicados arriba. Trabajo exclusivamente local, sin push, despliegue ni escrituras en la BD remota.

## B14: escaneo directo con cámara — 2026-10-19

- `barcode.js` incorpora `decodeBarcodeCamera(video, { signal, onReady })`, que reutiliza el lector ZXing local y el validador de códigos. Solicita solo vídeo, con preferencia por la cámara trasera, únicamente al pulsar Activar cámara. No graba ni envía fotogramas.
- La primera lectura válida libera las pistas y el decodificador y desconecta la vista previa antes de resolver el código. `scan-product.js` reutiliza la consulta/revisión existente, sin aceptar ni guardar automáticamente el producto.
- Detener, Escape, salir de Escanear producto, ocultar/abandonar la página y cambiar a foto o código manual cancelan la cámara. No se reabre automáticamente al regresar. Una concesión tardía del permiso se libera sin desplazar la vista previa de una sesión nueva.
- Se conserva la comida ante cancelaciones y errores de permisos, dispositivo ausente/ocupado, pérdida de cámara, API no disponible y contexto inseguro. Los mensajes permiten continuar mediante foto o entrada manual.
- **Verificación real en Chromium:** vídeo EAN de prueba servido como dispositivo de `getUserMedia`, decodificado por el ZXing real. Código `5901234123457`, ficha aislada con 12/3/4 g de HC/grasas/proteínas por 100 g y cantidad de 125 g. Una sola consulta, sin solicitudes de mutación:

| Estado de la comida | HC totales | Raciones | Entradas | Cámara |
| --- | --- | --- | --- | --- |
| Revisión antes de aceptar | 0 g | 0 | 0 | Apagada; pistas `ended` y vídeo desconectado |
| Después de aceptar | 15 g | 1,5 | 1 | Apagada |

- La aceptación produce 53,75 kcal / 0,36 UGP. La recarga conserva esa comida sin reabrir la cámara. La lectura de la misma imagen y la consulta manual siguen abriendo revisión sin sumar; editar allí a 250 g cambia la vista previa, no la comida aceptada.
- Comprobados Detener/Escape, navegación real por `pushState` y cambio al selector de foto/entrada manual. `pagehide`, visibilidad, desconexión y errores de permisos/dispositivo/contexto se ejercitaron mediante eventos o fallos controlados. En todos esos recorridos se observaron pistas finalizadas y vídeo desconectado, sin cambiar la comida.
- Carrera de permisos comprobada con dos adquisiciones reales del dispositivo simulado: cancelar una solicitud pendiente y comenzar otra conserva la pista nueva activa, mientras la concesión antigua tardía termina inmediatamente.
- Inspección visual en claro a 320 px y oscuro a 390/1280 px, sin desbordamiento en los recorridos medidos. Axe-core no detectó infracciones automáticas en la cámara activa; dejó una comprobación inconclusa, por lo que no se declara una certificación WCAG completa.
- Shell **v15** activado y recargado offline. El lector y la cámara arrancan sin conexión; consultar productos nuevos y guardar remotamente siguen necesitando red. `npm test`: **21 pruebas correctas**; sintaxis de `barcode.js`, `scan-product.js`, `dosis.js` y `sw.js` correcta.
- **Límites:** se ha usado una cámara virtual con vídeo conocido, no un teléfono físico. No se han certificado enfoque, reflejos, permisos del sistema ni compatibilidad de cámara real en Safari/iOS o Android. Sin push, despliegue ni escrituras en Supabase; B04/B05 y la activación del guardado remoto mantienen sus bloqueos anteriores.
- La instantánea anterior de Graphify no se ha reconstruido en esta implementación; queda marcada con `graphify-out/needs_update` para no tratarla como un mapa actualizado del escáner.

## B15: organización de Gramos → Raciones / Alimentos HC — 2026-10-19

- Búsqueda y cantidad tienen etiquetas sobre sus campos y comparten alineación en escritorio. Añadir a la comida y añadir/quitar favorito forman una única fila de acciones con el mismo tamaño, en vez de botones repartidos con anchos de toda la página.
- Se separan visualmente la entrada de alimentos, favoritos, alimentos de la comida y comidas guardadas. Reiniciar comida queda junto a la cabecera de la lista que gestiona; conserva su confirmación y su alcance sobre toda la comida.
- Inputs, selectores y botones principales del apartado miden 48 px de alto. La cantidad ocupa 200 px en escritorio; las acciones principales tienen un máximo de 220 px por botón. En móvil los campos y acciones se apilan con el ancho de su grupo. Los botones compactos de favoritos mantienen anchos iguales entre sí.
- Guardar y recuperar plantillas utilizan grupos adaptables con etiquetas y acciones alineadas. Se acortan los textos visibles de sus botones sin cambiar el guardado ni la recuperación de una copia editable.
- Se conservan los identificadores, las relaciones accesibles, la paleta personal, los cálculos y toda la lógica JavaScript de comida/escáner. La búsqueda desplegable deja de heredar márgenes de botón que separaban sus opciones.
- Navegador real: búsqueda con flechas/Enter/Escape, favorito sin añadir comida, cantidad negativa sin insertar filas, edición de cantidad, composición desplegable, añadir/quitar entradas, guardar/cargar/eliminar plantilla y cancelar/aceptar el reinicio.

| Recorrido de cálculo comprobado | Resultado observado |
| --- | --- |
| Añadir 100 g del arroz del catálogo, con 76,9 g HC/100 g | 76,9 g HC / 7,69 raciones |
| Editar esa entrada a 80 g | 61,52 g HC / 6,15 raciones |

- Recuperar una copia editable restaura las cantidades guardadas; editarla no altera la plantilla original. Borrador, favorito y plantilla se conservan tras recarga. El reinicio conserva los guardados y los ajustes. Las cantidades anteriores prueban el funcionamiento del cálculo, no la acreditación nutricional pendiente en B05.
- Geometría comprobada a 320, 390, 560, 768, 1100 y 1440 px: sin desbordamiento horizontal, campos alineados cuando están en la misma fila y alturas/ancho de acciones equivalentes. Inspección visual en claro y oscuro, con texto largo en favoritos, comida añadida y estados de error.
- Axe-core 4.13.0: cero infracciones automáticas y cero comprobaciones inconclusas en los estados de escritorio y móvil ejercitados. No se declara certificación WCAG completa ni prueba de lector de pantalla.
- Shell **v16** activado y nueva interfaz recargada offline: búsqueda y selección desde el catálogo guardado disponibles, con los mismos tamaños de control y sin añadir comida al seleccionar. Los otros apartados siguen disponibles. En la prueba offline solo se observaron los fallos de red esperados, sin excepciones JavaScript de la aplicación.
- Cambios locales de estructura, CSS y versión de caché; sin nuevas dependencias, push, despliegue ni escrituras en Supabase. El grafo anterior de Graphify conserva su aviso de actualización pendiente.

