import { applyCors, json, readJsonBody, requireEnv } from "./_lib/http.js";
import { signToken } from "./_lib/token.js";

export default async function handler(req, res) {
  if (applyCors(req, res, { methods: ["POST", "OPTIONS"] })) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const ADMIN_PASSWORD = requireEnv("ADMIN_PASSWORD");
    const ADMIN_TOKEN_SECRET = requireEnv("ADMIN_TOKEN_SECRET");

    const { password } = readJsonBody(req);
    if (!password) return json(res, 400, { ok: false, error: "Missing password" });
    if (password !== ADMIN_PASSWORD) return json(res, 401, { ok: false, error: "Invalid credentials" });

    const token = signToken({ role: "admin" }, ADMIN_TOKEN_SECRET, { expiresInSeconds: 60 * 60 * 6 });
    return json(res, 200, { ok: true, token });
  } catch (e) {
    return json(res, 500, { ok: false, error: "Server misconfigured" });
  }
}

