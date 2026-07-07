import crypto from 'crypto';
import { db, bucket } from './_lib/firebaseAdmin.js';
import { applyCors, json } from './_lib/http.js';

export default async function handler(req, res) {
    if (applyCors(req, res, { methods: ['POST', 'OPTIONS'] })) return;

    if (req.method !== 'POST') {
        return json(res, 405, { error: 'Method not allowed' });
    }

    try {
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

        // Check expiration
        if (new Date(pinData.expiresAt) < now) {
            await pinRef.delete();
            return json(res, 400, { error: 'El PIN ha expirado. Por favor solicita uno nuevo.' });
        }

        // Check attempts limit (max 5 attempts)
        const MAX_ATTEMPTS = 5;
        if (pinData.attempts >= MAX_ATTEMPTS) {
            await pinRef.delete();
            return json(res, 400, { error: 'Has excedido el número máximo de intentos. Solicita un nuevo PIN.' });
        }

        // Hash PIN to compare
        const incomingHashed = crypto.createHash('sha256').update(pin.trim()).digest('hex');

        if (incomingHashed !== pinData.hashedPin) {
            const nextAttempts = pinData.attempts + 1;
            if (nextAttempts >= MAX_ATTEMPTS) {
                await pinRef.delete();
                return json(res, 400, { error: 'PIN incorrecto. Se han agotado los intentos. Solicita un nuevo PIN.' });
            } else {
                await pinRef.update({ attempts: nextAttempts });
                return json(res, 400, { 
                    error: 'PIN incorrecto.', 
                    attemptsRemaining: MAX_ATTEMPTS - nextAttempts 
                });
            }
        }

        // PIN is correct! Proceed to upload signature
        const base64Data = signatureImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const signatureFile = bucket.file(`signatures/${uid}.png`);

        await signatureFile.save(buffer, {
            metadata: { contentType: 'image/png' },
            public: true
        });

        // Get public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/signatures/${uid}.png`;

        const contractVersion = process.env.CURRENT_CONTRACT_VERSION || '1.0';
        const signedAt = new Date().toISOString();

        // Write contract record
        await db.collection('debtContracts').doc(uid).set({
            customerUID: uid,
            contractVersion,
            signed: true,
            signedAt,
            typedName: typedName.trim(),
            signatureImageURL: publicUrl,
            verificationMethod: 'email_pin',
            verificationVerified: true,
            ip: ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
            userAgent: userAgent || req.headers['user-agent'] || 'unknown'
        });

        // Update user profile status
        await db.collection('users').doc(uid).update({
            contractSigned: true,
            contractVersion,
            contractSignedAt: signedAt,
            updatedAt: signedAt
        });

        // Delete PIN record
        await pinRef.delete();

        return json(res, 200, { ok: true });
    } catch (e) {
        console.error("Error signing contract:", e);
        return json(res, 500, { error: 'Error interno al guardar la firma.' });
    }
}
