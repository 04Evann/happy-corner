// Este archivo debe ir en la carpeta /api de tu proyecto Vercel
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fetch = require('node-fetch');

const LOYVERSE_ACCESS_TOKEN = process.env.LOYVERSE_API_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método no permitido. Solo se acepta POST.' });
    }

    const { customerCode, customerPin } = req.body;

    if (!customerCode || !customerPin) {
        return res.status(400).json({ success: false, message: 'Faltan datos: código de cliente o PIN.' });
    }

    const API_BASE_URL = 'https://api.loyverse.com/v1.0';

    try {
        const response = await fetch(`${API_BASE_URL}/customers?access_token=${LOYVERSE_ACCESS_TOKEN}&q=${customerCode}`);
        
        if (!response.ok) {
            console.error('Error en la API de Loyverse:', response.status, response.statusText);
            return res.status(500).json({ success: false, message: 'Error al conectar con Loyverse. Intenta de nuevo.' });
        }
        
        const data = await response.json();

        if (!data.customers || data.customers.length === 0) {
            return res.status(404).json({ success: false, message: 'Código de cliente o PIN incorrecto.' });
        }

        const customer = data.customers[0];
        const comments = customer.comments;
        
        const storedPin = comments ? comments.substring(0, 6) : null;

        if (storedPin !== customerPin) {
            return res.status(401).json({ success: false, message: 'Código de cliente o PIN incorrecto.' });
        }

        res.status(200).json({
            success: true,
            customer: {
                name: customer.name,
                customer_code: customer.customer_code,
                total_points: customer.total_points,
                email: customer.email || 'No registrado',
            }
        });

    } catch (error) {
        console.error('Error en la función de Vercel:', error);
        res.status(500).json({ success: false, message: 'Ocurrió un error. Por favor, inténtalo de nuevo.' });
    }
}
