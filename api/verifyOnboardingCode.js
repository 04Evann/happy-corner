import { db } from './_lib/firebaseAdmin.js';
import { applyCors, json } from './_lib/http.js';

export default async function handler(req, res) {
    if (applyCors(req, res, { methods: ['POST', 'OPTIONS'] })) return;

    if (req.method !== 'POST') {
        return json(res, 405, { error: 'Method not allowed' });
    }

    try {
        const { customerUID, customerCode } = req.body;

        if (!customerUID || !customerCode) {
            return json(res, 400, { error: 'Falta customerUID o customerCode' });
        }

        const cleanCode = customerCode.trim().toUpperCase();

        const limitRef = db.collection('rateLimits').doc(`onboarding_${customerUID}`);
        const limitSnap = await limitRef.get();
        if (limitSnap.exists) {
            const limitData = limitSnap.data();
            if (limitData.attempts >= 10 && (Date.now() - limitData.lastAttempt < 60 * 60 * 1000)) {
                return json(res, 429, { error: 'Demasiados intentos. Por favor espera 1 hora.' });
            }
        }
        await limitRef.set({
            attempts: limitSnap.exists && (Date.now() - limitSnap.data().lastAttempt < 60 * 60 * 1000) ? limitSnap.data().attempts + 1 : 1,
            lastAttempt: Date.now()
        }, { merge: true });
        
        // Regex: HC followed by 4 to 6 alphanumeric characters
        const codeRegex = /^HC[A-Z0-9]{4,6}$/;
        if (!codeRegex.test(cleanCode)) {
            return json(res, 400, { error: 'Formato de código inválido. Debe empezar con "HC" seguido de 4 a 6 caracteres alfanuméricos.' });
        }

        const lookupRef = db.collection('customerCodes').doc(cleanCode);
        const userRef = db.collection('users').doc(customerUID);

        const result = await db.runTransaction(async (transaction) => {
            // Check lookup document
            const lookupSnap = await transaction.get(lookupRef);
            if (lookupSnap.exists) {
                return { ok: false, error: 'code_taken' };
            }

            // Check if user already has a code
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists) {
                return { ok: false, error: 'user_not_found' };
            }

            const userData = userSnap.data();
            if (userData.customerCode) {
                return { ok: false, error: 'already_has_code' };
            }

            // Perform transaction writes
            transaction.set(lookupRef, { uid: customerUID });
            transaction.update(userRef, {
                customerCode: cleanCode,
                updatedAt: new Date().toISOString()
            });

            return { ok: true };
        });

        if (!result.ok) {
            if (result.error === 'code_taken') {
                return json(res, 400, { error: 'Ese código ya existe, prueba otro.' });
            }
            if (result.error === 'user_not_found') {
                return json(res, 404, { error: 'El usuario no existe.' });
            }
            if (result.error === 'already_has_code') {
                return json(res, 400, { error: 'Este usuario ya tiene un código asignado.' });
            }
        }

        return json(res, 200, { ok: true });
    } catch (e) {
        console.error("Error verifyOnboardingCode:", e.message);
        return json(res, 500, { error: 'Error interno del servidor.' });
    }
}
