import { db } from './_lib/firebaseAdmin.js';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { nombre } = req.query;
        if (!nombre) return res.status(200).json({ hasDeuda: false });

        let searchName = nombre.trim().toLowerCase();

        // Get all users with active debt
        const snapshot = await db.collection('users')
            .where('activeDebt', '>', 0)
            .get();

        const deudores = [];
        snapshot.forEach(doc => {
            const u = doc.data();
            const fullName = u.displayName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Estudiante';
            deudores.push({
                nombre: fullName,
                monto: u.activeDebt,
                detalle: u.debtStatus || "Pendientes"
            });
        });

        if (deudores.length === 0) {
            return res.status(200).json({ hasDeuda: false });
        }

        // Search for matching name (similarity check)
        let match = deudores.find(d => {
            let n = d.nombre.toLowerCase();
            return searchName.includes(n) || n.includes(searchName);
        });

        if (match) {
            // Capitalize first letter of each word
            let capitalizedName = match.nombre.split(' ')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(' ');
            return res.status(200).json({ 
                hasDeuda: true, 
                deudorData: {
                    nombre: capitalizedName,
                    monto: match.monto,
                    detalle: match.detalle || "Pendiente en tienda"
                }
            });
        }

        return res.status(200).json({ hasDeuda: false });
    } catch (e) {
        console.error("Error checkDeuda:", e.message);
        res.status(500).json({ error: e.message });
    }
}
