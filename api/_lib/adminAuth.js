import { getBearerToken, json, requireEnv } from "./http.js";
import { verifyToken } from "./token.js";

export function requireAdmin(req, res) {
  const secret = requireEnv("ADMIN_TOKEN_SECRET");
  const token = getBearerToken(req);
  const v = verifyToken(token, secret);
  if (!v.ok) {
    json(res, 401, { ok: false, error: "Unauthorized" });
    return null;
  }
  if (v.payload?.role !== "admin") {
    json(res, 403, { ok: false, error: "Forbidden" });
    return null;
  }
  return v.payload;
}

