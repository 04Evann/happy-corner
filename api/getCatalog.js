import { happyCatalog } from './_lib/catalog.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Enviar solo los nombres al Atajo para que se muestren limpios
        const names = happyCatalog.map(item => item.name);
        return res.status(200).json({ catalogNames: names, fullCatalog: happyCatalog });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
