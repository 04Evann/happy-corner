// Asegúrate de que este archivo esté dentro de la carpeta 'api' de tu proyecto Vercel

const fetch = require('node-fetch');

// El token ahora se busca usando el nombre de tu variable de entorno
const LOYVERSE_ACCESS_TOKEN = process.env.LOYVERSE_API_KEY;

module.exports = async (req, res) => {
    // Solo procesa solicitudes POST
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { customerCode, customerPin } = req.body;

    // Validación básica de los datos
    if (!customerCode || !customerPin) {
        return res.status(400).json({ success: false, message: 'Faltan datos de cliente o PIN.' });
    }

    try {
        // 1. Buscar al cliente en Loyverse
        const response = await fetch(`https://api.loyverse.com/v1.0/customers?access_token=${LOYVERSE_ACCESS_TOKEN}&q=${customerCode}`);
        const data = await response.json();

        if (!data.customers || data.customers.length === 0) {
            return res.status(404).json({ success: false, message: 'Código de cliente no encontrado.' });
        }

        const customer = data.customers[0];
        const comments = customer.comments;
        
        // 2. Extraer el PIN y comparar
        const storedPin = comments ? comments.substring(0, 6) : null;

        if (storedPin !== customerPin) {
            return res.status(401).json({ success: false, message: 'Código de cliente o PIN incorrecto.' });
        }

        // 3. Si todo es correcto, devuelve la información del cliente
        res.status(200).json({ success: true, customer: customer });

    } catch (error) {
        console.error('Error en la función de Vercel:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
};
