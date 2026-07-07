# HappyCorner - Cuenta, Pedidos y Deuda - Specs + Fixes

Contexto: reemplazar Loyverse como fuente de datos de cliente/pedidos. Todo vive en Firebase (Firestore + Auth + Storage + Cloud Functions). NO usar Supabase.

---

## 1. Colecciones Firestore

### users
```
uid, customerCode, firstName, lastName, displayName, email, phone, grade,
photoURL,
happyPoints, activeDebt, debtStatus,
contractSigned, contractVersion, contractSignedAt,
createdAt, updatedAt
```

### orders
```
orderId, customerUID, customerCode, items[], subtotal, total,
paymentMethod, status, createdAt, updatedAt, completedAt
```
Estados: pending | preparing | ready | completed | cancelled

### movements
```
movementId, customerUID, type, amount, description, createdAt
```
Tipos: purchase | payment | refund | points | adjustment

### debtContracts
```
customerUID, contractVersion, signed, signedAt, typedName,
signatureImageURL, verificationMethod, verificationVerified,
ip, userAgent
```

---

## 2. customerCode - elegido por el cliente

Decisión: el customerCode NO se autogenera de forma secuencial (HC000001...). El cliente elige su propio código al registrarse.

Fixes obligatorios para que esto no se rompa:
- Formato fijo validado en cliente Y en Cloud Function (ej: prefijo `HC` + 4-6 alfanuméricos, sin espacios, sin caracteres especiales).
- Unicidad garantizada con una colección lookup dedicada:
  ```
  customerCodes/{code} -> { uid: <uid> }
  ```
- Verificar disponibilidad y reservar el código dentro de una **misma transacción de Firestore** (`runTransaction`): leer `customerCodes/{code}`, si no existe, crear el doc lookup + el campo en `users` en la misma transacción. Esto evita que dos usuarios reclamen el mismo código en paralelo (race condition).
- Rechazar códigos ya usados con mensaje claro en el frontend ("ese código ya existe, prueba otro").
- El campo `customerCode`, una vez asignado, debe quedar **inmutable** vía Security Rules (no se puede reescribir después de creado).

---

## 3. Seguridad - lo más crítico del sistema

`activeDebt` y `happyPoints` NUNCA deben ser escribibles directamente por el cliente. Son dinero real / puntos reales.

- Firestore Security Rules: bloquear `update`/`write` del cliente sobre `activeDebt` y `happyPoints` en `users`. Solo lectura.
- Toda modificación de deuda/puntos ocurre exclusivamente vía **Cloud Function** (Admin SDK, que ignora las Security Rules), disparada por creación de un documento en `movements`.
- `movements` y `debtContracts`: colecciones de solo-lectura para el cliente. Escritura solo desde Cloud Functions.
  - Si el cliente pudiera escribir `movements` directamente, cualquiera podría crear un movement tipo `payment` y "pagar" su propia deuda sin que exista transacción real.
- Trigger recomendado: `onCreate` en `movements/{movementId}` -> recalcula `activeDebt`/`happyPoints` del `customerUID` correspondiente y actualiza `users/{uid}`.

---

## 4. PIN de verificación (firma de contrato)

- TTL: expira en 5-10 minutos.
- Máximo 3-5 intentos fallidos, luego invalidar y forzar reenvío.
- Guardar el PIN hasheado (no en texto plano) en un doc temporal, nunca en el documento final de `debtContracts`.

---

## 5. Paginación

`orders` y `movements` por usuario: usar `.limit(N)` + cursores (`startAfter`) para "Ver historial completo" / "Ver todos". No traer la colección completa - crece indefinidamente y encarece lecturas de Firestore.

---

## 6. Flujo de login

1. Login exitoso -> leer doc de `users/{uid}`.
2. Si `contractSigned == false` O `contractVersion != CURRENT_CONTRACT_VERSION` -> mostrar modal de contrato inmediatamente.
3. Modal: título "Contrato de Deuda HappyCorner", botones "Leer contrato" / "Firmar ahora".

## 7. Flujo de firma

1. Leer contrato.
2. Escribir nombre completo.
3. Dibujar firma (canvas -> imagen).
4. Enviar PIN al correo.
5. Ingresar y verificar PIN (ver reglas de sección 4).
6. Guardar en `debtContracts`: fecha, hora, versión, firma (URL en Storage), nombre, IP, user agent.
7. Marcar `contractSigned = true`, `contractVersion = CURRENT_CONTRACT_VERSION` en `users/{uid}`.

Nota: este contrato es para control interno / disuasión, no se está tratando como instrumento legal formal frente a terceros.

---

## 8. Pantalla "Mi Cuenta" - rediseño

Secciones, en este orden:
1. **Bienvenida** - "Hola, {Nombre}"
2. **Deuda** - deuda actual, estado, próximo pago. Botón "Ver contrato".
3. **Últimos pedidos** - card con número, fecha, productos, estado, total. Botón "Ver historial completo" (paginado).
4. **HappyPuntos** - puntos actuales + equivalencia en dinero. Botón "Canjear".
5. **Movimientos** - últimos movimientos (compra/pago/ajuste/puntos). Botón "Ver todos" (paginado).
6. **Perfil** - foto de perfil (`photoURL`), nombre, displayName, correo, teléfono, curso, customerCode. Permitir subir o cambiar la foto desde cámara o galería; almacenar la imagen en Firebase Storage y guardar su URL en `photoURL`. Botón "Editar perfil".
7. **Contratos** - estado, versión, fecha de firma. Botón "Ver contrato".
8. **Configuración** - cambiar contraseña, cerrar sesión.

Requisitos de diseño:
- Tarjetas limpias, bordes redondeados, sombras suaves, animaciones discretas.
- Responsive.
- Modo claro y oscuro (seguir el sistema de diseño actual de HappyCorner, paleta: Soft Blossom #ffc1d7, Peach Glow #fac599, Pastel Pink #fcc7d1, Amber Glow #f7a335, Atomic Tangerine #f26c38).
- Tiempo real vía Firestore listeners en deuda, pedidos, puntos y movimientos - la UI se actualiza sin recargar.
- Sensación general: rápida y moderna, tipo app bancaria / e-commerce.

---

## 9. Eliminar dependencia de Loyverse

No usar la API de Loyverse para historial de pedidos, datos de cliente, teléfono, ni códigos internos. Todo eso sale exclusivamente de Firestore de ahora en adelante.

---

## 10. SEO - para que HappyCorner aparezca mejor en Google

Nota: "Mi Cuenta", el contrato de deuda y todo lo que tenga datos de usuario debe llevar `noindex` (no queremos que Google indexe páginas privadas). El SEO aplica a las páginas públicas: home, catálogo, HappyOrder, etc.

### Meta tags básicos (en cada página pública)
```html
<title>Happy Corner | Dulces, snacks y combos</title>
<meta name="description" content="Descripción única de 150-160 caracteres por página, con palabras clave reales que la gente buscaría.">
<link rel="canonical" href="https://happycorner.lol/pagina-actual">
<meta name="robots" content="index, follow">
```
Páginas privadas (cuenta, contrato, admin):
```html
<meta name="robots" content="noindex, nofollow">
```

### Open Graph / redes sociales
```html
<meta property="og:title" content="Happy Corner">
<meta property="og:description" content="...">
<meta property="og:image" content="https://happycorner.lol/assets/og-image.jpg">
<meta property="og:url" content="https://happycorner.lol">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
```

### Datos estructurados (Schema.org)
Ayuda a Google a entender que HappyCorner es un negocio local y qué productos vende.
- `LocalBusiness` en la home (nombre, dirección/zona, horario, teléfono).
- `Product` en cada producto del catálogo (nombre, precio, disponibilidad).
- Implementar como JSON-LD en el `<head>`, no en microdata inline.

### Archivos técnicos obligatorios
- `robots.txt` en la raíz - permitir rutas públicas, bloquear `/admin`, `/mi-cuenta`, `/order` con datos sensibles.
- `sitemap.xml` - listar solo páginas públicas, enviarlo a Google Search Console.
- Verificar el dominio en **Google Search Console** (esto es gratis y es el primer paso real de SEO, sin esto no hay forma de monitorear cómo te ve Google).

### SEO local (clave para un negocio físico en un instituto)
- Crear/reclamar el perfil de **Google Business Profile** con nombre, categoría (tienda de snacks/dulces), zona de Cali, horario.
- Consistencia del nombre/dirección en todos lados donde aparezca HappyCorner online.

### Rendimiento (Google usa velocidad como factor de ranking - Core Web Vitals)
- Comprimir imágenes de producto (WebP en vez de PNG pesado).
- Lazy loading en imágenes fuera del viewport inicial (`loading="lazy"`).
- Minimizar JS/CSS bloqueante en el `<head>`.
- Evitar que scripts como `auth-state.js` bloqueen el render inicial si no son críticos.

### Contenido y estructura semántica
- Un solo `<h1>` por página (ej: el nombre del producto o "Happy Corner").
- Jerarquía real de encabezados (`h1` > `h2` > `h3`), no saltarse niveles.
- `alt` descriptivo en cada imagen de producto (ej: `alt="Pizza HappyCorner con arequipe y chocolate"`), no vacío ni genérico.
- URLs limpias y legibles (`/catalogo/pizza-arequipe` en vez de `/p?id=123`).

### Prioridad de implementación
1. Search Console + sitemap + robots.txt (gratis, 30 min, base de todo).
2. Meta tags + noindex en páginas privadas.
3. Schema.org LocalBusiness + Product.
4. Google Business Profile.
5. Optimización de imágenes/performance.
