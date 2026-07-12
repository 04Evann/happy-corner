# Happy Corner - Specs: Panel Admin, Footer Global, Header, y Rediseno de PDF/Correo

Fecha: 2026-07-11
Contexto: Happy Corner (happycorner.lol actualmente, dominio en transicion - ver seccion 0)

---

## 0. DOMINIO (bloqueante, resolver antes de lo demas)

- El dominio actual `happycorner.lol` NO se renovara (costo de renovacion no justificado para el uso actual).
- Nuevo dominio aun sin decidir (candidato: `happycorner.wtf`, evaluando alternativas menos agresivas).
- **Accion para Antigravity:** en todo el codigo, evitar hardcodear `happycorner.lol` directo donde sea evitable. Usar una variable de entorno `NEXT_PUBLIC_SITE_URL` (o equivalente) centralizada en un solo archivo de config, para que el cambio de dominio futuro sea un solo edit + redeploy, no un buscar-y-reemplazar en 20 archivos.
- El panel admin (seccion 1) debe vivir en el subdominio `admin.[dominio-nuevo]` una vez se decida el dominio. Mientras tanto, puede desarrollarse en una ruta separada tipo `/admin-v2` para no bloquear el desarrollo.

---

## 1. PANEL ADMINISTRATIVO (reconstruccion completa)

### 1.1 Decision de arquitectura

**IMPORTANTE - alcance del borrado:** el reset es UNICAMENTE de los archivos/paginas de panel admin. NO tocar ni borrar nada relacionado a contratos, mi-cuenta, onboarding, u otras paginas del cliente - eso queda intacto y funcionando.

**Borrar solamente estas paginas admin existentes:**
- `/admin` (version vieja, desactualizada)
- La pagina "deudores-admin" (o como se llame) con el boton de login que no funciona
- Cualquier otro archivo admin residual encontrado en el repo (buscar por nombre de archivo, no por contenido, para no llevarse nada de cliente por error)

**Limpieza de funciones serverless huerfanas (libera espacio real en el limite de 12 del plan Hobby):**
- `api/adminAuth.js` - solo lo usaban los paneles admin viejos que se estan borrando
- `api/managerDeudas.js` - sistema de deudas legacy pre-Firestore (usaba un secreto hardcodeado y logica `NUEVA/PAGAR/DEUDORES`), ya reemplazado por el sistema actual de `movements`/`debtContracts`
- `api/getCatalog.js` - era para un Apple Shortcut en el Apple Watch que ya no se usa (se reemplazo por recordatorios de Siri directos)
- `api/_lib/catalog.js` - queda huerfano una vez se borran los 2 archivos anteriores, ya que era su unico consumidor
- **NO borrar** `api/telegramWebhook.js` - sigue en uso activo (notificaciones de pedidos + OTP del sistema anterior)
- Resultado: de 12/12 funciones reales se libera a 9/12, dejando 3 espacios para futuros endpoints reales del admin-v2/pos-v2 si se necesitan

**Construir DOS apps nuevas separadas, cada una en su propio subdominio:**
- Panel administrativo: `admin.[dominio-nuevo]`
- POS (punto de venta): `pos.[dominio-nuevo]` (ver seccion 1.4 - se separa del panel admin porque tiene un uso y diseno distinto)
- Mientras el dominio no este decidido, desarrollar en rutas separadas `/admin-v2` y `/pos-v2` dentro del mismo proyecto Vercel, y migrar a subdominios cuando el dominio este listo.

### 1.2 Por que fallaba la seguridad del panel viejo (diagnostico, no repetir este error)

El panel viejo aparentemente ocultaba el contenido admin solo con CSS/overlay (un frame o modal de login "encima" del contenido), pero el HTML y los datos ya estaban cargados en el DOM. Al alejar el zoom del navegador o inspeccionar el DOM, el contenido admin era visible sin autenticacion real.

**Regla para el panel nuevo:** el contenido del panel NUNCA debe:
- Renderizarse en el DOM antes de confirmar el rol admin
- Cargarse via query a Firestore antes de confirmar `role == 'admin'`
- Depender solo de ocultar visualmente con CSS (`display:none`, overlays, z-index)

**Patron correcto:**
```
1. onAuthStateChanged -> si no hay usuario, redirect inmediato a /login
2. Si hay usuario, leer /users/{uid} y confirmar campo role == 'admin'
   (esto ademas debe estar protegido por las reglas de Firestore, no solo el cliente)
3. Solo si role == 'admin', renderizar el contenido del panel y hacer las queries
4. Mientras se confirma el rol (pasos 1-2), mostrar una pantalla de carga vacia,
   NUNCA el contenido del panel de fondo
```

Esto ya se alinea con la funcion `isAdmin()` que ya existe en `firestore.rules` - el panel nuevo debe respetar exactamente esa misma logica del lado del cliente tambien.

### 1.3 Funcionalidades del panel admin nuevo (3 secciones, una pestana/tab cada una)

**A. Buscar Clientes**
- Barra de busqueda por: nombre, HappyCodigo (ej. HC1234), o UID
- Resultado muestra: nombre, HappyCodigo, email, deuda activa, happyPoints, fecha de registro
- Click en un cliente -> vista detalle con historial de movements y orders

**B. Buscar Contratos**
- Barra de busqueda por HappyCodigo o nombre
- Resultado muestra: estado (firmado/no firmado), fecha de firma, version, link al PDF (pdfUrl de `debtContracts`)
- Debe reusar el campo `pdfUrl` que ya se genera en `/api/contract.js`

**C. Historial Crediticio (ver seccion 2 para el diseno del sistema completo)**
- Ver el puntaje actual de cualquier cliente buscado
- Editar manualmente el puntaje (con un campo de motivo/nota, para quedar registrado quien y por que lo cambio)

### 1.4 POS (Punto de Venta) - app separada

El POS vive aparte del panel admin, en su propio subdominio (`pos.[dominio-nuevo]`), porque el uso es distinto: es para vender rapido en persona (en el mostrador de Happy Corner), no para administrar datos.

**Referencia de diseno: interfaz estilo Shopify POS** - grid grande de productos con imagen/precio tocables, carrito lateral que se va llenando, totales grandes y claros, botones grandes pensados para pantalla tactil (tablet/celular en el mostrador, no solo mouse).

**Funcionalidad:**
- Grid de productos del catalogo (imagen, nombre, precio) - tap para agregar al carrito
- Carrito lateral con cantidad ajustable por item y total en vivo
- Buscar/asociar cliente por HappyCodigo (autocompletar rapido) - opcional, puede ser venta sin cliente asociado tambien
- Al confirmar venta: crea un documento en `orders` igual que el flujo normal del sitio (mismo schema, para no duplicar logica de reportes despues)
- Toggle claro entre "Pagado en efectivo/transferencia" vs "A credito" (si es a credito, genera el movement de deuda correspondiente)
- Pantalla de confirmacion grande y simple tras cada venta (piensa en velocidad - el que lo usa esta atendiendo una fila de gente)

---

## 2. SISTEMA DE HISTORIAL CREDITICIO

### 2.1 Estructura en Firestore

Nueva coleccion `creditScores`:
```
creditScores/{uid}
  - score: number (0-100, empieza en 20 para usuarios nuevos - como un historial crediticio real, se construye con el tiempo)
  - tier: string calculado ('A' >= 85, 'B' >= 65, 'C' >= 40, 'D' < 40)
  - lastUpdated: timestamp
  - history: array de { date, change, reason, adminUid (si fue manual) }
```

### 2.2 Logica automatica de ajuste

- Cuando un `movement` marca una deuda como pagada, un Cloud Function (trigger `onUpdate` en `debtContracts` o `movements`) calcula cuantos dias tardo el pago desde que se genero la deuda:
  - Pago en <= 3 dias: +5 puntos
  - Pago en 4-7 dias: 0 puntos
  - Pago en 8-14 dias: -5 puntos
  - Pago en 15-30 dias: -10 puntos
  - Pago en mas de 30 dias o marcado como impago: -20 puntos
- El score se limita entre 0 y 100 (clamp)
- Cada cambio automatico se agrega al array `history` con `reason` descriptivo (ej. "Pago realizado en 2 dias (+5)", "Pago realizado en 20 dias (-10)", "Marcado como impago (-20)") - esto es lo que se muestra en el historial del cliente (ver 2.4)

### 2.3 Edicion manual (desde el panel admin)

- El admin puede escribir directamente un nuevo score
- Se le pide obligatoriamente un motivo (texto corto)
- Se guarda en `history` con `reason` (el texto del admin) y `adminUid` (quien hizo el cambio)
- Reglas de Firestore: `creditScores/{uid}` -> `allow write: if isAdmin()`, `allow read: if isOwner(uid) || isAdmin()`

### 2.4 Visibilidad para el cliente (estilo "mini DataCredito")

- En `/mi-cuenta`, mostrar TANTO el tier (A/B/C/D) COMO el numero exacto del puntaje (ej. "72/100 - Nivel B")
- Debajo, mostrar el historial de movimientos del puntaje (el array `history` de la seccion 2.1), tipo timeline: fecha, motivo, y el cambio (+5, -10, etc). Esto le permite al cliente entender EXACTAMENTE por que su puntaje esta como esta, similar a como DataCredito muestra el detalle de por que baja o sube un puntaje real.
- Nota de implementacion: como todavia no existe funcionalidad para registrar deudas de clientes (el panel admin que gestiona esto es parte de este mismo spec, seccion 1), este modulo no tiene datos reales para mostrar todavia. Construir la UI y dejarla lista, pero no habra historial que mostrar hasta que el panel admin (seccion 1) este funcionando y se puedan crear deudas/movements de verdad.

### 2.5 Prioridad de visibilidad en la pagina de mi-cuenta

- **IMPORTANTE:** el bloque de estado del contrato (firmado/no firmado, boton para firmar, boton "ver contrato") debe estar AL INICIO/TOP de la pagina `/mi-cuenta`, no al final donde esta actualmente.
- Ademas, si el cliente NO ha firmado el contrato todavia, actualmente la pagina no dice nada al respecto (queda en silencio). Cambiar esto: si `contractSigned` es `false` o no existe, mostrar un bloque visible y claro invitando a firmar (ej. "Firma tu contrato de responsabilidad para acceder a compras a credito" + boton de accion), no dejarlo vacio/silencioso.

---

## 3. FOOTER GLOBAL (estilo Apple, en todas las paginas)

### 3.1 Contenido

Footer con 4 columnas (colapsa a acordeon en movil):

**Columna 1 - Happy Corner**
- Logo pequeno + nombre
- Enlace a Home (`/index`)
- Enlace a Catalogo (`/catalogo`)

**Columna 2 - Paginas**
- Listado de todas las paginas del sitio (mapa del sitio): Home, Catalogo, HappyOrder, Mi Cuenta, Terminos y Condiciones, y cualquier otra pagina html publica existente

**Columna 3 - Social**
- Instagram (icono + link)
- YouTube (icono + link)
- WhatsApp (icono + link directo a chat)
- Correo de contacto (mailto:)

**Columna 4 - Socios**
- Espacio para logos/links de negocios asociados o colaboradores de Happy Corner (a definir cuales exactamente - dejar la seccion lista con 2-3 slots de ejemplo para completar despues)

**Linea inferior (legal):**
- Copyright dinamico: `© {ano actual} Happy Corner`
- Link a Terminos y Condiciones (ver seccion 4)

### 3.2 Diseno

- Fondo mas oscuro/contrastante que el resto de la pagina (igual que Apple usa un gris muy oscuro para su footer)
- Mantener la paleta ya establecida de Happy Corner: NO usar el naranja del carrito aqui (ese color queda reservado solo para "Anadir a carrito"), usar tonos rosados/neutros del tema
- Fuente: Outfit para todo el footer, incluyendo el titulo "Happy Corner" (ya NO se usa Baloo 2 en el sitio - Happy Corner uso Poppins originalmente y ahora usa Outfit; mantener consistencia total con Outfit en todas partes, sin mezclar fuentes)
- Debe ser un solo componente/partial reutilizable (ej. `footer.html` incluido via JS o un componente compartido), NO copiar y pegar el HTML en cada pagina - para que un cambio futuro se haga en un solo lugar

---

## 4. HEADER - AGREGAR TERMINOS Y CONDICIONES

- Actualmente el link a Terminos y Condiciones no aparece en ningun header
- Agregar un link visible en el header (nav desktop y menu movil) apuntando a la pagina de terminos
- Si la pagina de Terminos y Condiciones no existe todavia como archivo, crear un placeholder basico que se pueda expandir despues

---

## 5. REDISENO DE PDF DEL CONTRATO Y CORREOS TRANSACCIONALES

### 5.1 Diagnostico actual

El PDF y los correos que genera `/api/contract.js` actualmente son texto plano sin marca - no reflejan la identidad visual rosada de Happy Corner que ya existe en el resto del sitio (perfil, mi-cuenta, etc).

### 5.2 PDF del contrato - mejoras

- Agregar el logo de Happy Corner en la parte superior del PDF (usar `pdf-lib`'s `embedPng` con el logo ya existente en el proyecto, ej. `loguito.png`)
- Usar Outfit (la fuente que usa el sitio completo hoy en dia - ya NO se usa Baloo 2 en ningun lado, consistencia total) para el titulo "Happy Corner" y encabezados de seccion. Como pdf-lib no soporta Google Fonts directo, hay que embeber el archivo .ttf de Outfit manualmente (descargable de Google Fonts) en vez de usar las fuentes estandar de pdf-lib (Helvetica, etc)
- Paleta: usar el rosa de marca (`--hp-pink`) en vez de negro puro para titulos y lineas divisorias
- Estructura visual mejorada: separar secciones con lineas sutiles, usar mas espaciado, tabla simple para los datos de la firma (IP, dispositivo, navegador, ubicacion) en vez de lineas sueltas
- Footer del PDF con: nombre del sitio, fecha de generacion, numero de version del contrato

### 5.3 Correos transaccionales (Resend) - mejoras

- Convertir el HTML plano actual a una plantilla con:
  - Header con el logo de Happy Corner centrado
  - Gradiente rosa de marca (`--hp-gradient`) en el header del correo, no un rosa piano generico
  - Tipografia consistente con el sitio: Outfit para TODO (titulo y cuerpo), sin mezclar con Baloo 2 ni ninguna otra fuente
  - Footer del correo con links sociales (Instagram, YouTube, WhatsApp) - mismos que el footer del sitio
- Aplica tanto al correo de PIN (`action: 'sendPin'`) como al correo de contrato firmado (`action: 'sign'`)
- Mantener HTML de correo simple e inline-styled (los clientes de correo no soportan CSS externo ni la mayoria de fuentes web, hay que usar `font-family` con fallbacks tipo `'Outfit', Arial, sans-serif` sabiendo que muchos clientes caeran al fallback)

---

## 6. ORDEN DE IMPLEMENTACION SUGERIDO

1. Mover el bloque de contrato al inicio de `/mi-cuenta` + agregar el aviso cuando no esta firmado (cambio pequeno, arregla un hueco de UX ya identificado)
2. Footer global + link de Terminos en header (bajo riesgo, alto impacto visual inmediato)
3. Rediseno de PDF y correos con Outfit (ya existe la logica funcional, solo se mejora el diseno)
4. Sistema de historial crediticio (backend primero: coleccion, Cloud Function, reglas) + UI en mi-cuenta
5. Panel administrativo nuevo (borrar los viejos primero) - se beneficia de tener ya listo el historial crediticio del paso 4
6. POS nuevo (app separada, estilo Shopify) - puede desarrollarse en paralelo al panel admin ya que comparten el schema de `orders` pero son interfaces independientes

---

## 7. PENDIENTE DE DEFINIR ANTES DE EMPEZAR

- [ ] Nombre de dominio final (afecta subdominio del admin)
- [ ] Links reales de Instagram, YouTube, WhatsApp (URLs exactas)
- [ ] Logos/nombres de "socios" para la columna 4 del footer
- [ ] Contenido legal real de Terminos y Condiciones (por ahora placeholder)