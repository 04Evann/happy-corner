# HappyCorner - Fixes pendientes post-migracion Firestore

Contexto: revision del walkthrough de migracion Supabase/Loyverse -> Firebase. Lo siguiente quedo sin resolver o necesita confirmacion antes de considerar el deploy como terminado.

---

## 1. Storage Security Rules como archivo real (CRITICO)

El walkthrough pide configurar manualmente en la consola de Firebase que `signatures` y `avatars` permitan lectura publica. Eso no es suficiente y no debe hacerse solo desde la consola.

Fix requerido:
- Crear un archivo `storage.rules` versionado en el repo (no instrucciones para la consola).
- Reglas:
  - Lectura publica permitida en `avatars/{uid}/**` y `signatures/{uid}/**`.
  - Escritura permitida SOLO si `request.auth.uid == uid` (cada usuario solo puede escribir en su propia carpeta).
- Sin la regla de escritura restringida, cualquier usuario autenticado podria sobrescribir la foto de perfil o la firma digital de otro usuario.

## 2. TTL del PIN de contrato

`signContract.js` valida un maximo de 5 intentos, pero no queda confirmado que el PIN expire por tiempo.

Fix requerido:
- Verificar que `signContract.js` chequee el timestamp del PIN guardado en `verificationPins/{uid}` y lo rechace si pasaron mas de 5-10 minutos, sin importar si quedan intentos disponibles.

## 3. Rate-limiting en endpoints de PIN y customerCode

`sendContractPin.js` y `verifyOnboardingCode.js` no tienen limite de solicitudes.

Fix requerido:
- Limitar `sendContractPin.js` a un maximo razonable de solicitudes por usuario en una ventana de tiempo (ej: 3 cada 10 min), para evitar spam de correos (costo en Resend) y abuso.
- Limitar intentos de `verifyOnboardingCode.js` para evitar scraping de que codigos estan disponibles.

## 4. Redirect de dashboard.html

Confirmar que `dashboard.html` no simplemente se borro, sino que redirige a `/mi-cuenta` (via `vercel.json` rewrites/redirects), para que links viejos guardados no den 404.

## 5. Cloud Function trigger vs. llamada directa a movementsHelper

Decision arquitectonica a confirmar conscientemente (no es un bug, pero hay que decidirlo a proposito):
- El spec original pedia un trigger `onCreate` en `movements` (Cloud Functions) para recalcular `activeDebt`/`happyPoints` automaticamente, sin depender de que cada endpoint recuerde llamar al helper.
- La implementacion actual llama `movementsHelper.js` directamente desde cada endpoint (`managerDeudas.js`, etc.). Funciona, pero si en el futuro se agrega un endpoint nuevo que cree un movement y se olvide de llamar el helper, la deuda queda desincronizada sin que nadie lo note.
- Confirmar si se acepta este riesgo o si se prefiere migrar a un trigger de Cloud Functions mas adelante.

## 6. npm install fallido en el sandbox

Correr `npm install` localmente (o dejar que Vercel lo resuelva en el deploy) y confirmar que `firebase-admin` y las demas dependencias nuevas quedaron bien declaradas en `package.json`, sin typos de version.

## 7. Test de condicion de carrera en customerCode

El verification plan no incluye probar que pasa si dos usuarios intentan reservar el mismo customerCode al mismo tiempo (el motivo por el que existe la transaccion). Agregar una prueba manual: dos pestañas intentando registrar el mismo codigo simultaneamente, confirmar que solo una gana.

---

## Prioridad sugerida

1. Storage rules como archivo real (afecta seguridad de datos de otros usuarios).
2. Confirmar TTL del PIN.
3. Rate-limiting en PIN y customerCode.
4. Confirmar redirect de dashboard.html.
5. Decision consciente sobre Cloud Function trigger vs. llamada directa.
6. Verificar npm install / package.json.
7. Test manual de race condition en customerCode.
