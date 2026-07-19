import { db, auth } from "./_lib/firebaseAdmin.js";
import { applyCors, json } from "./_lib/http.js";

export default async function handler(req, res) {
  if (applyCors(req, res, { methods: ["GET", "OPTIONS"] })) return;

  const { codigo } = req.query;
  if (!codigo) {
    return json(res, 400, { error: 'Falta el parámetro "codigo"' });
  }

  try {
    const idToken = (req.headers.authorization || '').replace('Bearer ', '');
    if (!idToken) return json(res, 401, { error: 'No autenticado.' });

    let decoded;
    try {
        decoded = await auth.verifyIdToken(idToken);
    } catch {
        return json(res, 401, { error: 'Token inválido.' });
    }

    // 1. Look up UID from customerCodes lookup collection
    const codeSnap = await db.collection('customerCodes').doc(codigo.trim().toUpperCase()).get();
    let uid = null;

    if (codeSnap.exists) {
      uid = codeSnap.data().uid;
    } else {
      // Fallback: search users collection directly in case of sync issues
      const userQuery = await db.collection('users')
        .where('customerCode', '==', codigo.trim().toUpperCase())
        .limit(1)
        .get();
      
      if (!userQuery.empty) {
        uid = userQuery.docs[0].id;
      }
    }

    if (!uid) {
      return json(res, 404, { error: 'HappyCódigo no encontrado. Por favor, verifica el código.' });
    }

    // 2. Fetch user details
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return json(res, 404, { error: 'Usuario no encontrado en la base de datos.' });
    }

    const u = userSnap.data();
    const fullName = u.displayName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Usuario';

    // If the authenticated user owns the code, return full profile
    if (decoded.uid === uid) {
      // 3. Fetch last 5 movements
      const movementsSnap = await db.collection('movements')
        .where('customerUID', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      const receipts = [];
      movementsSnap.forEach(doc => {
        const m = doc.data();
        receipts.push({
          recibo: m.movementId ? m.movementId.substring(0, 8).toUpperCase() : doc.id.substring(0, 8).toUpperCase(),
          fecha: m.createdAt 
            ? new Date(m.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
            : 'Sin fecha',
          total: m.amount,
          tienda: m.type.toUpperCase() // e.g. PURCHASE, PAYMENT, POINTS
        });
      });

      return json(res, 200, {
        nombre: fullName,
        happyCodigo: u.customerCode || codigo.trim().toUpperCase(),
        correo: u.email || 'No registrado',
        telefono: u.phone || '',
        puntos: u.happyPoints || 0,
        ultimas_transacciones: receipts
      });
    }

    // Otherwise, limit the response to public, non-sensitive fields
    return json(res, 200, {
      nombre: fullName,
      puntos: u.happyPoints || 0
    });

  } catch (err) {
    console.error("Error getPoints:", err);
    return json(res, 500, { error: 'Error consultando datos. Por favor, inténtalo de nuevo.' });
  }
}

