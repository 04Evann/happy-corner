import crypto from 'crypto';
import { Resend } from 'resend';
import { db, bucket } from './_lib/firebaseAdmin.js';
import { applyCors, json } from './_lib/http.js';

export default async function handler(req, res) {
    if (applyCors(req, res, { methods: ['POST', 'OPTIONS'] })) return;

    if (req.method !== 'POST') {
        return json(res, 405, { error: 'Method not allowed' });
    }

    try {
        const { action } = req.body;

        if (action === 'sendPin') {
            const { uid, email } = req.body;
            if (!uid || !email) return json(res, 400, { error: 'Falta uid o correo electrónico.' });

            const resendKey = process.env.RESEND_API_KEY;
            if (!resendKey) return json(res, 500, { error: 'El servicio de correos no está configurado.' });

            const pinRef = db.collection('verificationPins').doc(uid);
            const existingPin = await pinRef.get();
            if (existingPin.exists) {
                const data = existingPin.data();
                if (data.createdAt) {
                    const createdTime = new Date(data.createdAt).getTime();
                    if (Date.now() - createdTime < 3 * 60 * 1000) {
                        return json(res, 429, { error: 'Por favor espera 3 minutos antes de solicitar un nuevo PIN.' });
                    }
                }
            }

            const resend = new Resend(resendKey);
            const pin = Math.floor(100000 + Math.random() * 900000).toString();
            const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

            await pinRef.set({
                hashedPin,
                expiresAt,
                attempts: 0,
                createdAt: new Date().toISOString()
            });

            const emailResult = await resend.emails.send({
                from: 'Happy Corner <no-reply@happycorner.lol>',
                to: [email],
                subject: 'Tu PIN para firmar el Contrato de Happy Corner',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
                        <h2 style="color: #ff4d8b;">Happy Corner 🩷</h2>
                        <p>Has solicitado firmar tu contrato digital.</p>
                        <p>Tu PIN de verificación es:</p>
                        <h1 style="font-size: 36px; letter-spacing: 5px; color: #333;">${pin}</h1>
                        <p>Este PIN expirará en 10 minutos. No lo compartas con nadie.</p>
                    </div>
                `
            });

            if (emailResult.error) {
                console.error("Resend error:", emailResult.error);
                return json(res, 500, { error: 'Error enviando el correo.' });
            }

            return json(res, 200, { success: true });
        }

        if (action === 'sign') {
            const { uid, typedName, signatureImage, pin, ip, userAgent } = req.body;
            if (!uid || !typedName || !signatureImage || !pin) {
                return json(res, 400, { error: 'Faltan campos requeridos para firmar el contrato.' });
            }

            const pinRef = db.collection('verificationPins').doc(uid);
            const pinSnap = await pinRef.get();

            if (!pinSnap.exists) {
                return json(res, 400, { error: 'No se ha solicitado ningún PIN para este usuario o ya expiró.' });
            }

            const pinData = pinSnap.data();
            const now = new Date();

            if (new Date(pinData.expiresAt) < now) {
                await pinRef.delete();
                return json(res, 400, { error: 'El PIN ha expirado. Por favor solicita uno nuevo.' });
            }

            if (pinData.attempts >= 5) {
                await pinRef.delete();
                return json(res, 400, { error: 'Has excedido el número máximo de intentos. Solicita un nuevo PIN.' });
            }

            const incomingHashed = crypto.createHash('sha256').update(pin.trim()).digest('hex');

            if (incomingHashed !== pinData.hashedPin) {
                await pinRef.update({ attempts: pinData.attempts + 1 });
                return json(res, 401, { error: `PIN incorrecto. Intento ${pinData.attempts + 1} de 5.` });
            }

            const match = signatureImage.match(/^data:image\/(png|jpeg);base64,(.+)$/);
            if (!match) return json(res, 400, { error: 'Formato de imagen de firma no válido.' });
            const imageBuffer = Buffer.from(match[2], 'base64');
            const fileName = `signatures/${uid}/contract_v1.png`;
            const file = bucket.file(fileName);
            await file.save(imageBuffer, {
                metadata: { contentType: `image/${match[1]}` },
                public: true
            });

            const timestamp = now.toISOString();
            await db.collection('debtContracts').add({
                uid,
                typedName,
                signatureUrl: `https://storage.googleapis.com/${bucket.name}/${fileName}`,
                version: 'v1',
                signedAt: timestamp,
                ip: ip || 'unknown',
                userAgent: userAgent || 'unknown'
            });

            await db.collection('users').doc(uid).update({
                contractSigned: true,
                contractVersion: 'v1',
                contractSignedAt: timestamp
            });

            await pinRef.delete();
            return json(res, 200, { success: true, message: 'Contrato firmado correctamente.' });
        }

        return json(res, 400, { error: 'Acción no válida.' });

    } catch (error) {
        console.error("Error in contract API:", error);
        return json(res, 500, { error: 'Internal Server Error' });
    }
}
