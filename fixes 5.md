# Happy Corner - Ronda 8 (Final): Seguridad del Token, Pagina de Verificacion, Sync Telegram, Bug Visual, Gauge de Credito

Fecha: 2026-07-13

Este documento consolida TODO lo pendiente de las rondas anteriores. Ejecutar en el orden indicado (1 es lo mas urgente).

---

## 1. URGENTE - Restaurar la seguridad real del token de verificacion

**Problema:** en `api/getOrders.js`, la variable `tokenBase64` que se manda en el link de verificacion de pre-ordenes se genera hoy con un simple `Buffer.from(JSON.stringify(payloadObj)).toString('base64')` - esto NO tiene firma criptografica, cualquiera puede construir su propio JSON, codificarlo en base64, y la pagina `/verify` lo va a aceptar como legitimo sin validar nada contra la base de datos. Ya existe en el proyecto el sistema correcto para esto: `api/_lib/token.js` con `signToken(payload, secret, opts)` y `verifyToken(token, secret)`.
Osea, al hacer un pedido, la paagina genera un qr, y edn vez de mostrarme la pagina con info de el pedido y si el pedido es legitimo me lleva a la pagina de preordenes, a  ver si mañana llevan el $$ o no.

### Cambios requeridos

**[MODIFY] `api/getOrders.js`**
- Agregar import: `import { signToken } from './_lib/token.js';`
- Reemplazar:
  ```javascript
  const tokenBase64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
  ```
  Por:
  ```javascript
  const tokenBase64 = signToken(payloadObj, process.env.ORDER_VERIFY_SECRET, { expiresInSeconds: 60 * 60 * 24 });
  ```

**[MODIFY] `api/verifyPreorder.js`**
- Agregar import: `import { verifyToken } from './_lib/token.js';`
- Recibir el `token` original completo en el body de la peticion (no solo los campos ya decodificados)
- Validar el token ANTES de procesar cualquier cosa:
  ```javascript
  const v = verifyToken(token, process.env.ORDER_VERIFY_SECRET);
  if (!v.ok) return res.status(401).json({ error: 'Token invalido o vencido.' });
  if (v.payload.o !== orderId) return res.status(401).json({ error: 'Token no coincide con el pedido.' });
  ```
- Ademas, confirmar contra Firestore que el `orderId` (`v.payload.o`) realmente existe en la coleccion `orders` antes de marcar cualquier estado. Si no existe, rechazar con 404.

**[MODIFY] `verify.html`**
- Debe enviar el `token` original (el string completo que vino en `?auth=` en la URL) al endpoint `verifyPreorder`, no solo los campos que decodifico localmente con `atob()`. El decodificado local puede seguir usandose SOLO para mostrar visualmente el resumen al usuario en pantalla mientras carga, pero la fuente de verdad de la validacion debe ser el servidor revisando la firma.

**[ENV VAR] Agregar en Vercel Dashboard -> Settings -> Environment Variables:**
```
ORDER_VERIFY_SECRET = f54c9ba497a2190c25fe2d6275d070062f223be8c44a83d530343d5c3cdcb011
```
(Este valor ya fue generado con `openssl rand -hex 32`, es seguro usarlo tal cual. Redesplegar despues de agregarlo para que tome efecto.)

---

## 2. Pagina nueva de verificacion de recibos por QR + reconectar los QR existentes

**Problema:** `factura.html` y `confirmed.html` generan un QR que apunta a `/verify?order=XXX`, pero `verify.html` nunca consulto Firestore para confirmar que el pedido existe - solo mostraba lo que viniera en los parametros de la URL sin validar nada. Ademas `verify.html` en realidad esta dedicado a otra cosa (confirmar pre-ordenes via el token de la seccion 1), asi que se necesita una pagina SEPARADA y nueva, dedicada exclusivamente a verificar la legitimidad de un recibo escaneado.

### Cambios requeridos

**[NEW] `verificar-pedido.html`** (crear en la raiz del proyecto, mismo patron visual que el resto del sitio - dark theme, Outfit, variables CSS de `styles.css`)
- Lee `?order=` de la URL
- Hace `getDoc(doc(db, 'orders', orderId))` directo contra Firestore usando el `db` de `firebase-auth.js` (la regla `allow get: if true` en `orders` ya permite esta lectura publica, no requiere endpoint nuevo)
- Si el documento EXISTE: muestra pantalla verde "✅ Pedido Legitimo" con los datos reales (cliente, resumen, total, estado, fecha)
- Si NO existe: muestra pantalla roja clara "❌ Pedido no encontrado - este codigo no existe en el sistema, el recibo podria ser falso"

**[MODIFY] `factura.html`**
- Buscar: `text: \`https://happycorner.lol/verify?order=${num}\`,`
- Cambiar a: `text: \`https://happycorner.lol/verificar-pedido?order=${num}\`,`

**[MODIFY] `confirmed.html`**
- Mismo cambio que en `factura.html` (buscar la misma linea del QR y actualizarla)

**No tocar `verify.html`** - ese se queda exclusivamente para el flujo de pre-ordenes con token firmado (seccion 1).

---

## 3. Sincronizacion bidireccional Telegram <-> Base de Datos <-> Panel Admin

**Contexto importante:** el usuario confirmo que SOLO usa los botones de Telegram, nunca escribe los comandos de texto (`/confirmar_XXX`). Los botones actuales son tipo `url` (solo abren WhatsApp) y NO actualizan Firestore. El sistema de comandos de texto si actualiza Firestore pero no se usa. Hay que hacer que los BOTONES (los que si se usan) actualicen la base de datos.

### Cambios requeridos

**A. Convertir los botones del mensaje de pedido en botones de "callback" reales**

En `api/getOrders.js`, cambiar el `inline_keyboard` del mensaje inicial de Telegram: los botones "✅ Aprobar Pedido", "⏳ Pago Pendiente", "❌ Cancelar Pedido" deben pasar de ser `url` a ser `callback_data`:
```javascript
{ text: "✅ Aprobar Pedido", callback_data: `accept_${orderCode}` }
{ text: "⏳ Pago Pendiente", callback_data: `pending_${orderCode}` }
{ text: "❌ Cancelar Pedido", callback_data: `cancel_${orderCode}` }
```
El boton "📩 Enviar WA Pre-Orden" puede quedar como `url` normal (es solo informativo, no cambia estado).

**B. Guardar `chat_id` y `message_id` del mensaje de Telegram en el pedido**

Cuando se envia el mensaje inicial de Telegram del nuevo pedido, guardar en el documento `orders/{orderCode}`:
```javascript
telegramChatId: <chat_id de la respuesta de sendMessage>,
telegramMessageId: <message_id de la respuesta de sendMessage>
```

**C. Manejar `callback_query` en `api/telegramWebhook.js`**

Agregar una rama nueva (ademas de la que ya existe para `message.text`, que puede quedar de respaldo) que revise `req.body.callback_query`:
1. Parsear `callback_data` (ej. `accept_h-XXXXX`) para sacar la accion y el orderCode
2. Actualizar el estado del pedido en Firestore
3. Responder con `answerCallbackQuery` (obligatorio, si no el boton se queda con el reloj de carga infinito en Telegram)
4. Editar el mensaje original con `editMessageText` + `editMessageReplyMarkup` usando el `chat_id`/`message_id` guardados en el paso B, mostrando el nuevo estado y un boton nuevo `[📲 Enviar WhatsApp al cliente]` (este si como `url` link)

**D. Sincronizar en la direccion contraria: admin-v2 -> Telegram**

Como `admin-v2.html` opera client-side (transacciones directas a Firestore) para no gastar mas funciones serverless, y llamar a la API de Telegram desde el navegador expondria el `TELEGRAM_TOKEN` publicamente, se necesita un endpoint dedicado:

**[NEW] `api/syncTelegramStatus.js`** (usa 1 de los slots libres de funciones)
- Recibe `{ orderId, newStatus }` desde `admin-v2.html`
- Verifica que quien llama es admin
- Busca el pedido en Firestore, obtiene `telegramChatId`/`telegramMessageId`
- Llama a `editMessageText` de la API de Telegram para reflejar el nuevo estado en el mensaje original

En `admin-v2.html`: cuando el admin cambia el estado de un pedido desde la UI, ademas de la escritura normal a Firestore, hacer un `fetch` a `/api/syncTelegramStatus` con el `orderId` y el nuevo estado.

---

## 4. Bug visual: badge se sale del modal en admin-v2

**Problema (ver captura adjunta del usuario):** al abrir el modal de detalle de un cliente en `admin-v2.html`, un badge de estado (parece el badge de Tier/puntaje, `#modal-score-badge` o similar) se sale visualmente del modal y queda flotando encima del boton de cerrar (X), cortado y superpuesto de forma incorrecta.

**Accion:** revisar todos los elementos con `position:absolute` o `position:fixed` dentro de `#client-detail-modal` y sus hijos. Confirmar que `#modal-score-badge` y cualquier badge similar se renderice dentro del flujo normal del layout (no absoluto), y que el modal tenga `overflow` controlado para que nada se salga de sus bordes redondeados. Probar abriendo el modal de un cliente con Tier D asignado (ej. usuario de prueba "test1") para reproducir el bug.

---

## 5. Widget de medidor de puntaje crediticio (gauge tipo velocimetro)

**Objetivo:** reemplazar la visualizacion plana del puntaje (numero + letra A/B/C/D) por un medidor visual tipo velocimetro con 4 zonas de color, aguja indicadora, y mini grafica de tendencia.

### Cambios requeridos

**[NEW] `credit-gauge.js`** (archivo ya escrito, adjunto por separado - colocar en la raiz del proyecto, NO cuenta como funcion serverless por estar fuera de `/api`)
- Expone la funcion global `renderCreditGauge(containerId, score, history)`
- Dibuja un SVG semicircular con 4 zonas de color (rojo 0-40 / naranja 40-65 / azul 65-85 / verde 85-100), una aguja apuntando al puntaje actual, el numero grande centrado, y una mini linea de tendencia si se le pasa el array `history`

**[MODIFY] `mi-cuenta.html`**
- Agregar `<script src="/credit-gauge.js"></script>` antes de `</body>`
- Donde hoy se muestra el puntaje/tier del cliente de forma plana, reemplazar por `<div id="credit-gauge-container"></div>`
- Despues de leer el documento de `creditScores/{uid}`, llamar: `renderCreditGauge('credit-gauge-container', cs.score, cs.history)`

**[MODIFY] `admin-v2.html`**
- Mismo patron: agregar el script, agregar el contenedor en el modal de detalle de cliente (reemplazando o complementando `#modal-score-badge`), y llamar `renderCreditGauge(...)` dentro de `loadModalCreditScore(uid)` con los datos que ya se obtienen ahi

---

## Orden de ejecucion recomendado

1. Seccion 1 (seguridad del token) - critico, hacer primero
2. Seccion 2 (pagina de verificacion de QR) - depende de que el token este bien firmado
3. Seccion 4 (bug visual del badge) - rapido de arreglar, no depende de nada mas
4. Seccion 5 (gauge de credito) - cosmetico, independiente
5. Seccion 3 (sync de Telegram) - la mas grande, dejar para el final