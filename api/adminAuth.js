import crypto from 'crypto';
import fetch from 'node-fetch';
import { applyCors, json, readJsonBody, requireEnv } from "./_lib/http.js";
import { signToken } from "./_lib/token.js";

export default async function handler(req, res) {
  if (applyCors(req, res, { methods: ["POST", "OPTIONS"] })) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const body = readJsonBody(req);
    const action = body.action || req.query.action;

    if (action === 'login') {
        const ADMIN_PASSWORD = requireEnv("ADMIN_PASSWORD");
        const ADMIN_TOKEN_SECRET = requireEnv("ADMIN_TOKEN_SECRET");
        const { password } = body;
        if (!password) return json(res, 400, { ok: false, error: "Missing password" });
        if (password !== ADMIN_PASSWORD) return json(res, 401, { ok: false, error: "Invalid credentials" });
        const token = signToken({ role: "admin" }, ADMIN_TOKEN_SECRET, { expiresInSeconds: 60 * 60 * 6 });
        return json(res, 200, { ok: true, token });
    }
    
    if (action === 'requestPin') {
        const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, FIREBASE_API_KEY } = process.env;
        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !FIREBASE_API_KEY) {
            console.error("Missing env vars for requestPin");
            return json(res, 500, { error: 'Server configuration error' });
        }
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        const message = `🔐 *Solicitud de Acceso Admin*\n\nTu PIN temporal es: \`${pin}\`\n\nNo lo compartas con nadie.`;
        const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' })
        });
        if (!tgRes.ok) {
            console.error("Error sending Telegram message");
            return json(res, 500, { error: 'Failed to send PIN via Telegram' });
        }
        const hash = crypto.createHmac('sha256', FIREBASE_API_KEY).update(pin).digest('hex');
        return json(res, 200, { success: true, hash: hash });
    }
    
    if (action === 'verifyPin') {
        const { pin, hash } = body;
        const { FIREBASE_API_KEY } = process.env;
        if (!pin || !hash) return json(res, 400, { error: 'Falta PIN o hash' });
        const calculatedHash = crypto.createHmac('sha256', FIREBASE_API_KEY).update(pin).digest('hex');
        if (calculatedHash === hash) {
            return json(res, 200, { success: true });
        } else {
            return json(res, 401, { success: false, error: 'PIN incorrecto' });
        }
    }

    return json(res, 400, { ok: false, error: "Invalid action" });

  } catch (e) {
    console.error("Error in adminAuth:", e);
    return json(res, 500, { ok: false, error: "Internal Server Error" });
  }
}
