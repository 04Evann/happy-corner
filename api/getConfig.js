import { applyCors } from './_lib/http.js';

export default function handler(req, res) {
    if (applyCors(req, res, { methods: ['GET', 'OPTIONS'] })) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }


    // Retorna la configuración obtenida de las variables de entorno de Vercel
    res.status(200).json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://happycorner.top"
    });
}
