# HappyCorner - Fixes pendientes (consolidado, listo para enviar)

Contexto: nada de esto se le ha enviado a Antigravity todavia. Este documento reemplaza cualquier version anterior.

---

## 0. YA RESUELTO por el dueno del proyecto (confirmar en el codigo, no volver a tocar)

- **Resend**: dominio de envio verificado usando un SUBDOMINIO (no el dominio raiz happycorner.lol, para no interferir con el correo personal en Apple Mail/iCloud). Confirmar que `sendContractPin.js` usa el "from" con ese subdominio verificado, no `@happycorner.lol` a secas.
- **Cloudflare R2**: ya esta creado el bucket y las credenciales ya estan cargadas en Vercel como env vars:
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `R2_PUBLIC_URL` (URL publica tipo `https://pub-xxxx.r2.dev`, acceso publico ya habilitado para ese bucket)

---

## 1. CRITICO - Migrar Storage de Firebase a Cloudflare R2

Decision: Firebase Storage ahora exige plan Blaze (facturacion con prepago) para cualquier uso, incluyendo buckets ya existentes. El dueno del proyecto no puede/quiere completar ese pago ahora mismo. Se decide NO usar Firebase Storage. Las env vars de R2 ya estan configuradas en Vercel (ver seccion 0).

Fix requerido:
- Instalar `@aws-sdk/client-s3` (compatible con la API S3 de R2).
- Crear un helper `api/_lib/r2Client.js` que inicialice el cliente S3 apuntando al endpoint de R2: `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, usando `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`.
- Reemplazar en `api/signContract.js`: subir la firma (base64) a R2 en vez de Firebase Storage. Guardar la ruta como `signatures/{uid}/firma.png`, y en `debtContracts.signatureImageURL` guardar la URL publica completa (`R2_PUBLIC_URL + '/' + key`).
- Reemplazar en el flujo de "Perfil" de `mi-cuenta.html`: la subida de avatar debe ir a R2 en vez de Firebase Storage. Hacerlo a traves de un endpoint server-side (`api/uploadAvatar.js`) que reciba el archivo, verifique el token de Firebase Auth del usuario, lo suba a R2 con las credenciales del servidor, y devuelva la URL publica. El cliente nunca debe tener las credenciales de R2.
- Ruta de cada archivo debe incluir el `uid` del usuario para evitar colisiones: `avatars/{uid}/foto.jpg`, `signatures/{uid}/firma.png`.
- Validar en el endpoint de subida: tipo de archivo (`image/*` para avatar), tamano maximo (ej. 5MB).
- Eliminar la dependencia de `storage.rules` de Firebase (ya no aplica, no se usa Firebase Storage). Quitar tambien cualquier codigo que siga intentando subir a Firebase Storage.

---

## 2. CRITICO - Firestore permission-denied en listeners de mi-cuenta

Sintoma: `FirebaseError: [code=permission-denied]` en los listeners de deuda/pedidos/puntos/movimientos (onSnapshot) y en `loadContractStatus`, ademas de error al aceptar el contrato.

Causa probable: las Firestore Security Rules probablemente permiten `get` (leer un documento por ID) pero no `list` (queries con `where`, que es lo que usa mi-cuenta.html para traer orders/movements filtrados por `customerUID`). Un query con `where` es una operacion `list` y necesita su propio `allow list` explicito.

Fix requerido:
- Revisar `firestore.rules` y confirmar que las reglas de `orders`, `movements` y `debtContracts` permitan explicitamente `list` para el usuario autenticado dueno de los documentos.
- Confirmar que la escritura de aceptacion de contrato la hace el servidor (via `api/contract` o `api/signContract.js`), no el cliente directo a Firestore.
- Probar cada listener por separado antes de redeploy.

---

## 3. onboarding.js - TypeError: Cannot set properties of null (setting 'onclick')

Sintoma: `onboarding:190` - impide confirmar el customerCode elegido.

Fix requerido:
- Revisar linea 190 de onboarding, confirmar que el ID del elemento buscado coincide exactamente con el HTML.
- Envolver la asignacion del evento en `DOMContentLoaded` si no lo esta ya, o usar `addEventListener` con chequeo de null antes de asignar.

---

## 4. Firma con canvas no responde al cursor

Sintoma: dibujar la firma con mouse no funciona.

Fix requerido:
- Confirmar que los event listeners (`mousedown`, `mousemove`, `mouseup`) esten atados correctamente al canvas.
- Confirmar si esto se arregla solo al resolver el punto 3 (un error sin catch en un script puede detener la ejecucion de codigo posterior en el mismo archivo).
- Confirmar que existan tambien los eventos `touchstart/touchmove/touchend` para movil, ademas de los de mouse.

---

## 5. Google Sign-In no trae el correo

Sintoma: "no tengo correo" al loguear con Google, y no deja ingresar uno manualmente despues.

Causa probable: el codigo de creacion de perfil en Firestore probablemente asume que el email siempre viene de un input manual y no esta leyendo `firebaseUser.email`, que Firebase Auth SIEMPRE entrega cuando el proveedor es Google.

Fix requerido:
- Usar `firebaseUser.email` directamente del objeto de Auth al crear/actualizar `users/{uid}`, sin importar el proveedor.
- Como fallback (raro con Google, pero por si acaso), permitir completar el correo manualmente si viniera vacio, en vez de bloquear el flujo.

---

## 6. Editar perfil no permite poner/cambiar correo

Fix requerido:
- Confirmar si el campo de correo esta intencionalmente bloqueado (razonable si es el correo de acceso a la cuenta) o si es un bug. Si es intencional, mostrarlo como solo-lectura con una nota explicativa, no en blanco sin explicacion.

---

## 7. UX - Flujo de creacion de cuenta

Sintoma: el usuario llena toda su info y recien ahi ve que va a "crear cuenta", sin aviso previo.

Fix sugerido (no bloqueante):
- Agregar un titulo claro al inicio del formulario tipo "Estas creando tu cuenta HappyCorner" antes de pedir los datos.

---

## 8. UX - Boton de Google Sign-In y estilo de avisos

Fix sugerido (no bloqueante, backlog de UI):
- Mover el boton de "Login con Google" a una posicion mas prominente (arriba del formulario).
- Unificar todos los mensajes de error/exito/confirmacion bajo el mismo componente modal/toast que ya se usa en el resto del sitio.

---

## Prioridad sugerida

1. Migracion de Storage a Cloudflare R2 (bloquea avatares y firmas por completo, credenciales ya listas en Vercel).
2. Firestore rules (permission-denied) - bloquea toda la app en tiempo real.
3. onboarding.js null onclick - bloquea confirmar customerCode.
4. Firma con canvas (probablemente se resuelve junto con el punto 3).
5. Google Sign-In sin correo.
6. Editar perfil - campo de correo.
7-8. UX backlog - no bloqueante, al final.
