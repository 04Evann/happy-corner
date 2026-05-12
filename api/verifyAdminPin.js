import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { pin, hash } = req.body;
        const { FIREBASE_API_KEY } = process.env;

        if (!pin || !hash) {
            return res.status(400).json({ error: 'Falta PIN o hash' });
        }

        // Re-calcular el hash del PIN recibido
        const calculatedHash = crypto.createHmac('sha256', FIREBASE_API_KEY)
                                     .update(pin)
                                     .digest('hex');

        if (calculatedHash === hash) {
            // PIN correcto
            return res.status(200).json({ success: true });
        } else {
            // PIN incorrecto
            return res.status(401).json({ success: false, error: 'PIN incorrecto' });
        }

    } catch (error) {
        console.error("Error in verifyAdminPin:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
