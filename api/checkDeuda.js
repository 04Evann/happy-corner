import { db, auth } from './_lib/firebaseAdmin.js';
import { applyCors } from './_lib/http.js';

export default async function handler(req, res) {
    if (applyCors(req, res, { methods: ['GET', 'OPTIONS'] })) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const idToken = (req.headers.authorization || '').replace('Bearer ', '');
        if (!idToken) return res.status(401).json({ error: 'No autenticado.' });

        let decoded;
        try {
            decoded = await auth.verifyIdToken(idToken);
        } catch {
            return res.status(401).json({ error: 'Token inválido.' });
        }

        const userSnap = await db.collection('users').doc(decoded.uid).get();
        if (!userSnap.exists) return res.status(200).json({ hasDeuda: false });

        const u = userSnap.data();
        if (!u.activeDebt || u.activeDebt <= 0) return res.status(200).json({ hasDeuda: false });

        return res.status(200).json({
            hasDeuda: true,
            deudorData: {
                nombre: u.displayName || u.name || 'Estudiante',
                monto: u.activeDebt,
                detalle: u.debtStatus || 'Pendiente en tienda'
            }
        });
    } catch (e) {
        console.error("Error checkDeuda:", e.message);
        res.status(500).json({ error: e.message });
    }
}

