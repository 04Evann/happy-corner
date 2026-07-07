import { Resend } from 'resend';
import crypto from 'crypto';
import { db } from './_lib/firebaseAdmin.js';
import { applyCors, json } from './_lib/http.js';

export default async function handler(req, res) {
    if (applyCors(req, res, { methods: ['POST', 'OPTIONS'] })) return;

    if (req.method !== 'POST') {
        return json(res, 405, { error: 'Method not allowed' });
    }

    try {
        const { uid, email } = req.body;

        if (!uid || !email) {
            return json(res, 400, { error: 'Falta uid o correo electrónico.' });
        }

        const resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) {
            return json(res, 500, { error: 'El servicio de correos no está configurado (Falta RESEND_API_KEY).' });
        }

        const pinRef = db.collection('verificationPins').doc(uid);
        const existingPin = await pinRef.get();
        if (existingPin.exists) {
            const data = existingPin.data();
            if (data.createdAt) {
                const createdTime = new Date(data.createdAt).getTime();
                const nowTime = Date.now();
                // If requested within the last 3 minutes (180000 ms), reject
                if (nowTime - createdTime < 3 * 60 * 1000) {
                    return json(res, 429, { error: 'Por favor espera 3 minutos antes de solicitar un nuevo PIN.' });
                }
            }
        }

        const resend = new Resend(resendKey);

        // Generate 6 digit numeric pin
        const pin = Math.floor(100000 + Math.random() * 900000).toString();

        // Hash PIN using Node's crypto
        const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');

        // 10 minutes expiry
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // Save PIN data
        await db.collection('verificationPins').doc(uid).set({
            hashedPin,
            expiresAt,
            attempts: 0,
            createdAt: new Date().toISOString()
        });

        // Send Email
        const emailResult = await resend.emails.send({
            from: 'Happy Corner <no-reply@happycorner.lol>',
            to: email,
            subject: `🔑 Tu PIN de firma de contrato: ${pin}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 500px; margin: 0 auto; border: 1px solid #ffc1d7; border-radius: 15px; background-color: #fff5f7;">
                    <h2 style="color: #f26c38; text-align: center;">Firma de Contrato Happy Corner 🍭</h2>
                    <p>Hola,</p>
                    <p>Has solicitado firmar tu contrato de deuda con Happy Corner. Por favor utiliza el siguiente PIN para completar el proceso de verificación:</p>
                    <div style="background-color: #ffc1d7; color: #333; font-size: 32px; font-weight: bold; text-align: center; padding: 15px; margin: 20px 0; letter-spacing: 5px; border-radius: 10px;">
                        ${pin}
                    </div>
                    <p style="font-size: 13px; color: #666; text-align: center;">Este PIN expirará en 10 minutos por razones de seguridad. Si no solicitaste este código, puedes ignorar este correo.</p>
                    <hr style="border: 0; border-top: 1px solid #ffc1d7; margin: 20px 0;" />
                    <p style="font-size: 11px; color: #999; text-align: center;">Happy Corner Cali. Todos los derechos reservados.</p>
                </div>
            `
        });

        if (emailResult.error) {
            console.error("Resend error result:", emailResult.error);
            return json(res, 500, { error: 'No se pudo enviar el correo de verificación.' });
        }

        return json(res, 200, { ok: true });
    } catch (e) {
        console.error("Error sendContractPin:", e);
        return json(res, 500, { error: 'Error interno del servidor.' });
    }
}
