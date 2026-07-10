# HappyCorner - Ronda 5: bugs post-fix + features nuevas

Contexto: prueba en produccion despues de la migracion a R2 y los fixes de Firestore/onboarding/canvas. Algunas cosas mejoraron, otras siguen rotas, y se agregan 2 features nuevas.

---

## Confirmado funcionando

- El envio de codigo PIN al firmar ya funciona correctamente.

---

## 1. "Error verificando disponibilidad" al elegir customerCode

Sintoma: al intentar confirmar un HappyCodigo en onboarding, siempre muestra ese error generico, sin importar si el codigo esta libre o no.

Fix requerido:
- Revisar logs de `api/verifyOnboardingCode.js` en Vercel para ver el error real detras de ese mensaje generico.
- Confirmar que la transaccion de Firestore (`runTransaction`) no este fallando por un problema de referencia (ej: coleccion `customerCodes` mal escrita, o falta de permisos en las rules para que el propio usuario cree el doc de verificacion).
- Mostrar en el frontend el error especifico devuelto por el servidor (o al menos loguearlo en consola) en vez de un mensaje generico, para depurar mas rapido la proxima vez.

## 2. Firmar contrato TODAVIA no funciona (aunque el envio de PIN si)

Sintoma: el PIN llega bien, pero el paso de firmar (submit final) sigue sin completarse.

Fix requerido:
- Confirmar si el error es en el canvas (no deja dibujar/capturar la firma), en la subida a R2, o en el guardado final en Firestore (`debtContracts`).
- Revisar si el fix de `.doc(uid).set()` en vez de `.add()` ya quedo deployado y probado end-to-end, no solo escrito en el codigo.
- Traer el error exacto de consola del navegador la proxima vez que se pruebe, para no adivinar entre las 3 causas posibles.

## 3. Sesion se pierde al salir de mi-cuenta

Sintoma: las imagenes (avatar) funcionan, pero al salir de `/mi-cuenta` y volver, pide iniciar sesion de nuevo.

Causa probable: la persistencia de Firebase Auth no esta configurada explicitamente, o quedo en modo `SESSION`/`NONE` en vez de `LOCAL`.

Fix requerido:
- Confirmar que se llama `setPersistence(auth, browserLocalPersistence)` antes de cualquier login, para que la sesion sobreviva a cerrar/reabrir el navegador y no solo la pestana actual.

## 4. Crear cuenta nueva sigue raro (UX)

Sintoma: sigue sin sentirse claro el flujo de registro (esto ya se habia reportado, parece no haberse resuelto del todo).

Fix requerido:
- Pedir a Antigravity una captura o descripcion mas especifica de que parte se siente rara, o revisar `onboarding.html`/`login.html` completo para encontrar pasos confusos (orden de campos, falta de feedback visual, etc.).

## 5. Header muestra iniciales en vez de foto de perfil

Sintoma: en la esquina donde deberia aparecer el avatar del usuario logueado, muestra la inicial del nombre en vez de la foto real subida.

Fix requerido:
- En el componente del header (probablemente en `auth-state.js`), leer `photoURL` del documento de Firestore del usuario (o del objeto de Auth si aplica) y mostrar `<img>` con esa URL si existe; usar la inicial solo como fallback si no hay foto.

## 6. Google Sign-In sigue sin correo AL FIRMAR (aunque el login general ya se arreglo)

Sintoma: iniciar con Google funciona para loguear, pero al llegar al paso de firmar el contrato, sigue diciendo que no hay correo.

Causa probable: el fix anterior se aplico en `login.html` (`handleUserDocument`), pero el flujo de firma (`signContract.js` o el modal en `mi-cuenta.html`) probablemente lee el email desde otro lugar (ej: un campo del formulario que nunca se llena para usuarios de Google) en vez de leerlo de Firestore o del objeto de Auth actual.
- Adicionalmente, usuarios que se registraron con Google ANTES del fix pueden tener el campo `email` vacio en su documento de Firestore — el fix a futuro no corrige datos ya guardados.

Fix requerido:
- Confirmar que el modal de firma lea el email desde `auth.currentUser.email` o desde el documento de Firestore ya corregido, no desde un input separado.
- Si aplica, correr un backfill (unico, manual o script) para completar el campo `email` en documentos de `users` que hayan quedado vacios por cuentas de Google creadas antes del fix.

## 7. Portal HappyDeudas (admin-deudas) no funciona

Sintoma: el panel privado de administracion de deudas no esta funcionando tras la migracion.

Fix requerido:
- Traer el error especifico (consola del navegador + logs de Vercel de `api/managerDeudas.js`) para diagnosticar. Sospecha: la migracion de Supabase a Firestore pudo haber dejado alguna referencia vieja, o el token `DEUDAS_SECRET` no se esta validando igual que antes.

---

## 8. FEATURE NUEVA - Panel de administracion de clientes

Necesidad: una vista privada (protegida con el mismo `DEUDAS_SECRET` u otro mecanismo de admin) para:
- Listar todos los clientes (`users`), con su nombre, customerCode, estado de deuda.
- Ver si cada cliente firmo o no el contrato de deuda (`contractSigned`, `contractSignedAt`).
- Ver el historial de pedidos (`orders`) de cada cliente individual.
- Buscador simple por nombre o customerCode.

Fix/feature requerido:
- Nueva ruta protegida, ej: `/admin/clientes` o reutilizar `/deudores/:secret` existente, expandiendo la vista actual.
- Endpoint server-side que traiga usuarios paginados (no traer toda la coleccion de una sola vez si la base crece).
- Por cada cliente, un detalle expandible o pagina individual con sus `orders` mas recientes y el estado del contrato.
- Mantener esto fuera del indice de Google (`noindex`), es una herramienta interna.

---

## 9. FEATURE / FIX - Rastrear pedido no deberia exigir cuenta

Sintoma: la pagina de `/track` (Rastrear Pedido) actualmente obliga a iniciar sesion para ver el estado de un pedido.

Fix requerido:
- Permitir rastrear un pedido de forma publica usando solo el numero de orden (`orderId`) o el `customerCode` + algo adicional (ej: telefono) como verificacion simple, sin necesitar login.
- Ajustar Firestore rules para permitir lectura publica y limitada de un documento especifico de `orders` SOLO si se conoce el `orderId` exacto (nunca permitir `list` publico de todas las ordenes, solo `get` de una orden puntual por ID conocido).
- Mostrar en esa vista publica solo lo esencial (estado, productos, fecha) - no datos sensibles del cliente como deuda o info de contacto completa.

---

## Prioridad sugerida

1. Firmar contrato (bloquea el flujo mas importante del negocio).
2. Sesion se pierde al salir de mi-cuenta (afecta a todos los usuarios).
3. Error verificando disponibilidad de customerCode (bloquea registro nuevo).
4. HappyDeudas admin no funciona (afecta operacion diaria del negocio).
5. Google Sign-In sin correo al firmar + backfill de emails viejos.
6. Rastrear pedido sin cuenta (afecta experiencia de clientes que no se registran).
7. Panel de administracion de clientes (feature nueva, no bloqueante).
8. Header con foto de perfil (visual, no bloqueante).
9. UX de crear cuenta nueva (necesita mas detalle antes de poder arreglarse).