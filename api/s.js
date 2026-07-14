import { db } from './_lib/firebaseAdmin.js';

export default async function handler(req, res) {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('Falta el código del link.');
    }

    try {
        const snap = await db.collection('shortlinks').doc(code).get();

        if (!snap.exists || !snap.data().target) {
            return res.status(404).send('Este link expiró o no es válido.');
        }

        res.writeHead(302, { Location: snap.data().target });
        res.end();
    } catch (e) {
        console.error('Error resolviendo shortlink:', e);
        return res.status(500).send('Ocurrió un error, intenta de nuevo.');
    }
}