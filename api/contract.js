import crypto from 'crypto';
import { Resend } from 'resend';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db } from './_lib/firebaseAdmin.js';
import { s3Client, bucketName, publicUrl } from './_lib/r2Client.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { applyCors, json } from './_lib/http.js';

// ============================================================
// Helpers de IP, dispositivo, navegador y ubicacion
// ============================================================
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.socket?.remoteAddress || 'unknown';
}

function parseUserAgent(ua) {
    if (!ua) return { device: 'Desconocido', browser: 'Desconocido' };
    let device = 'Computador';
    if (/iPhone/i.test(ua)) device = 'iPhone';
    else if (/iPad/i.test(ua)) device = 'iPad';
    else if (/Android/i.test(ua)) device = 'Android';
    else if (/Macintosh/i.test(ua)) device = 'Mac';
    else if (/Windows/i.test(ua)) device = 'Windows';

    let browser = 'Desconocido';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';

    return { device, browser };
}

async function getLocationFromIp(ip) {
    try {
        if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('::1') || ip.startsWith('192.168.')) {
            return 'Red local / Desconocido';
        }
        const resp = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country,isp`);
        const data = await resp.json();
        const partes = [data.city, data.regionName, data.country].filter(Boolean);
        return partes.join(', ') + (data.isp ? ` (${data.isp})` : '');
    } catch {
        return 'Desconocido';
    }
}

async function generarPdfContrato({ typedName, signatureImageBuffer, signedAt, ip, device, browser, location }) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = 790;
    page.drawText('Happy Corner', { x: 50, y, size: 22, font: fontBold, color: rgb(0.97, 0.3, 0.6) });
    y -= 26;
    page.drawText('Contrato de Responsabilidad de Deuda', { x: 50, y, size: 13, font: fontBold });
    y -= 30;

    const contractText = [
        '1. RECONOCIMIENTO DE DEUDA: El cliente acepta que cualquier saldo pendiente',
        'en su cuenta representa una deuda real y exigible.',
        '2. TRANSPARENCIA: Los movimientos de deuda y pagos quedan registrados en el sistema.',
        '3. COMPROMISO DE PAGO: El cliente se compromete a no acumular deudas que superen',
        'su capacidad de pago.',
        '4. CONSECUENCIAS: En caso de incumplimiento, se podra negar el acceso a nuevas',
        'compras a credito.',
        '5. VOLUNTARIEDAD: El cliente confirma que acepta este contrato de forma voluntaria.',
        '',
        'Este documento es para control interno de Happy Corner.'
    ];

    for (const line of contractText) {
        page.drawText(line, { x: 50, y, size: 10, font: fontReg });
        y -= 15;
    }

    y -= 20;
    page.drawText('Datos de la firma:', { x: 50, y, size: 12, font: fontBold });
    y -= 20;

    const datos = [
        `Firmado por: ${typedName}`,
        `Fecha: ${signedAt}`,
        `Direccion IP: ${ip}`,
        `Dispositivo: ${device}`,
        `Navegador: ${browser}`,
        `Ubicacion aproximada: ${location}`
    ];
    for (const linea of datos) {
        page.drawText(linea, { x: 50, y, size: 10, font: fontReg });
        y -= 16;
    }

    y -= 20;
    page.drawText('Firma:', { x: 50, y, size: 12, font: fontBold });
    y -= 90;

    const pngImage = await pdfDoc.embedPng(signatureImageBuffer);
    page.drawImage(pngImage, { x: 50, y, width: 200, height: 80 });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

// ============================================================
// Handler principal
// ============================================================
export default async function handler(req, res) {
    if (applyCors(req, res, { methods: ['POST', 'OPTIONS'] })) return;

    if (req.method !== 'POST') {
        return json(res, 405, { error: 'Method not allowed' });
    }

    try {
        const { action } = req.body;

        // ============================================================
        // ACCION: sendPin (sin cambios respecto a tu version original)
        // ============================================================
        if (action === 'sendPin') {
            const { uid, email } = req.body;
            if (!uid || !email) return json(res, 400, { error: 'Falta uid o correo electronico.' });

            const resendKey = process.env.RESEND_API_KEY;
            if (!resendKey) return json(res, 500, { error: 'El servicio de correos no esta configurado.' });

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
                from: 'Happy Corner <no-reply@alertas.happycorner.lol>',
                to: [email],
                subject: 'Tu PIN para firmar el Contrato de Happy Corner',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
                        <h2 style="color: #ff4d8b;">Happy Corner 🩷</h2>
                        <p>Has solicitado firmar tu contrato digital.</p>
                        <p>Tu PIN de verificacion es:</p>
                        <h1 style="font-size: 36px; letter-spacing: 5px; color: #333;">${pin}</h1>
                        <p>Este PIN expirara en 10 minutos. No lo compartas con nadie.</p>
                    </div>
                `
            });

            if (emailResult.error) {
                console.error("Resend error:", emailResult.error);
                return json(res, 500, { error: 'Error enviando el correo.' });
            }

            return json(res, 200, { success: true });
        }

        // ============================================================
        // ACCION: sign (ACTUALIZADA con PDF + metadata real)
        // ============================================================
        if (action === 'sign') {
            const { uid, typedName, signatureImage, pin, userAgent } = req.body;
            if (!uid || !typedName || !signatureImage || !pin) {
                return json(res, 400, { error: 'Faltan campos requeridos para firmar el contrato.' });
            }

            const pinRef = db.collection('verificationPins').doc(uid);
            const pinSnap = await pinRef.get();

            if (!pinSnap.exists) {
                return json(res, 400, { error: 'No se ha solicitado ningun PIN para este usuario o ya expiro.' });
            }

            const pinData = pinSnap.data();
            const now = new Date();

            if (new Date(pinData.expiresAt) < now) {
                await pinRef.delete();
                return json(res, 400, { error: 'El PIN ha expirado. Por favor solicita uno nuevo.' });
            }

            if (pinData.attempts >= 5) {
                await pinRef.delete();
                return json(res, 400, { error: 'Has excedido el numero maximo de intentos. Solicita un nuevo PIN.' });
            }

            const incomingHashed = crypto.createHash('sha256').update(pin.trim()).digest('hex');

            if (incomingHashed !== pinData.hashedPin) {
                await pinRef.update({ attempts: pinData.attempts + 1 });
                return json(res, 401, { error: `PIN incorrecto. Intento ${pinData.attempts + 1} de 5.` });
            }

            const match = signatureImage.match(/^data:image\/(png|jpeg);base64,(.+)$/);
            if (!match) return json(res, 400, { error: 'Formato de imagen de firma no valido.' });
            const imageBuffer = Buffer.from(match[2], 'base64');

            // --- Capturar datos reales del lado del servidor ---
            const ip = getClientIp(req);
            const { device, browser } = parseUserAgent(userAgent);
            const location = await getLocationFromIp(ip);
            const timestamp = now.toISOString();

            if (!s3Client) {
                return json(res, 500, { error: 'R2 Storage no esta configurado.' });
            }

            // Subir imagen de firma a R2
            const signatureFileName = `signatures/${uid}/contract_v1.png`;
            await s3Client.send(new PutObjectCommand({
                Bucket: bucketName,
                Key: signatureFileName,
                Body: imageBuffer,
                ContentType: `image/${match[1]}`
            }));

            // Generar PDF y subirlo a R2
            const pdfBuffer = await generarPdfContrato({
                typedName,
                signatureImageBuffer: imageBuffer,
                signedAt: timestamp,
                ip, device, browser, location
            });
            const pdfFileName = `contracts/${uid}/contract_v1.pdf`;
            await s3Client.send(new PutObjectCommand({
                Bucket: bucketName,
                Key: pdfFileName,
                Body: pdfBuffer,
                ContentType: 'application/pdf'
            }));
            const pdfUrl = `${publicUrl}/${pdfFileName}`;

            // Guardar contrato en Firestore
            await db.collection('debtContracts').doc(uid).set({
                uid,
                customerUID: uid,
                signed: true,
                typedName,
                signatureUrl: `${publicUrl}/${signatureFileName}`,
                pdfUrl,
                version: 'v1',
                signedAt: timestamp,
                ip,
                device,
                browser,
                location,
                userAgent: userAgent || 'unknown'
            });

            await db.collection('users').doc(uid).update({
                contractSigned: true,
                contractVersion: 'v1',
                contractSignedAt: timestamp
            });

            // Enviar PDF por correo (al admin y al cliente)
            const userSnap = await db.collection('users').doc(uid).get();
            const clienteEmail = userSnap.data()?.email;
            const resend = new Resend(process.env.RESEND_API_KEY);
            const pdfBase64 = pdfBuffer.toString('base64');

            const destinatarios = ['happycorner.com@gmail.com'];
            if (clienteEmail) destinatarios.push(clienteEmail);

            await resend.emails.send({
                from: 'Happy Corner <no-reply@alertas.happycorner.lol>',
                to: destinatarios,
                subject: `Contrato firmado - ${typedName}`,
                html: `
                    <div style="font-family: Arial, sans-serif;">
                        <h2 style="color:#ff4d8b;">Happy Corner 🩷</h2>
                        <p>Contrato firmado por <b>${typedName}</b> el ${timestamp}.</p>
                        <p>IP: ${ip} · Dispositivo: ${device} · Navegador: ${browser}</p>
                        <p>Ubicacion aproximada: ${location}</p>
                        <p>Adjunto encontraras el PDF firmado.</p>
                    </div>
                `,
                attachments: [{ filename: `contrato_${typedName}.pdf`, content: pdfBase64 }]
            });

            await pinRef.delete();
            return json(res, 200, { success: true, message: 'Contrato firmado correctamente.', pdfUrl });
        }

        return json(res, 400, { error: 'Accion no valida.' });

    } catch (error) {
        console.error("Error in contract API:", error);
        return json(res, 500, { error: 'Internal Server Error' });
    }
}