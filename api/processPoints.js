// /api/processPoints.js

import { ApiClient, TransactionalEmailsApi } from 'sib-api-v3-sdk';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://happycorner.lol');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido. Solo se acepta POST.' });
    }

    const { codigo, totalPedido, emailCliente, nombreCliente } = req.body;

    if (!codigo || !totalPedido || !emailCliente || !nombreCliente) {
        return res.status(400).json({ error: 'Faltan parámetros necesarios: happyCode, totalPedido, emailCliente, nombreCliente.' });
    }

    const loyverseToken = process.env.LOYVERSE_API_KEY;
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!loyverseToken || !brevoApiKey) {
        return res.status(500).json({ error: 'Falta la clave de API de Loyverse o Brevo en el servidor.' });
    }

    const loyverseAPI = 'https://api.loyverse.com/v1.0';

    try {
        // 1. Encontrar al cliente y verificar su saldo
        const response = await fetch(`${loyverseAPI}/customers?customer_code=${encodeURIComponent(codigo)}`, {
            headers: { 'Authorization': `Bearer ${loyverseToken}` }
        });

        if (!response.ok) {
            throw new Error(`Loyverse API Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        const customer = data.customers && data.customers.length > 0 ? data.customers[0] : null;

        if (!customer) {
            return res.status(404).json({ error: 'HappyCódigo no encontrado.' });
        }

        const puntosNecesarios = totalPedido; // 1 punto = $1 COP
        if (customer.total_points < puntosNecesarios) {
            return res.status(402).json({ error: 'Puntos insuficientes para completar la compra.' });
        }
        
        // 2. Descontar los puntos del cliente
        const newPoints = customer.total_points - puntosNecesarios;
        const updateResponse = await fetch(`${loyverseAPI}/customers/${customer.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${loyverseToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                total_points: newPoints
            })
        });

        if (!updateResponse.ok) {
            throw new Error(`Loyverse API Update Error: ${updateResponse.status} - ${updateResponse.statusText}`);
        }

        const updatedCustomer = await updateResponse.json();
        
        // 3. Enviar correo de confirmación con Brevo
        const defaultClient = ApiClient.instance;
        const apiKey = defaultClient.authentications['api-key'];
        apiKey.apiKey = brevoApiKey;

        const apiInstance = new TransactionalEmailsApi();
        const sendSmtpEmail = {
            to: [{ email: emailCliente, name: nombreCliente }],
            sender: { email: 'soporte@happycorner.lol', name: 'Happy Shop' },
            subject: '¡Tu HappyOrder ha sido procesada!',
            htmlContent: `
                <html>
                <body>
                    <h2>¡Hola, ${nombreCliente}!</h2>
                    <p>¡Tu pedido en Happy Shop ha sido procesado exitosamente!</p>
                    <p>Hemos descontado **${puntosNecesarios.toLocaleString('es-CO')} puntos** de tu cuenta. Ahora tu nuevo saldo es de **${updatedCustomer.total_points.toLocaleString('es-CO')} Happy Puntos**.</p>
                    <br/>
                    <p>¡Gracias por tu compra!</p>
                    <p>El equipo de Happy Shop.</p>
                </body>
                </html>
            `,
        };

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        
        // 4. Enviar respuesta exitosa a la página
        res.status(200).json({
            message: 'Pago procesado exitosamente con Happy Puntos.',
            puntosDescontados: puntosNecesarios,
            puntosActuales: updatedCustomer.total_points
        });

    } catch (error) {
        console.error('Error al procesar el pago con puntos:', error);
        res.status(500).json({ error: 'No se pudo procesar el pago. Por favor, contacta a soporte.' });
    }
}
