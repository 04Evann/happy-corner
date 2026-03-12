import crypto from "crypto";

function b64urlEncode(input) {
  return Buffer.from(input).toString("base64url");
}

function b64urlDecode(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function signToken(payloadObj, secret, { expiresInSeconds = 60 * 60 } = {}) {
  const payload = {
    ...payloadObj,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = b64urlEncode(payloadJson);
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyToken(token, secret) {
  if (!token || typeof token !== "string") return { ok: false, error: "missing_token" };
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "bad_format" };

  const [payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  const equal = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  if (!equal) return { ok: false, error: "bad_signature" };

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64));
  } catch {
    return { ok: false, error: "bad_payload" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) return { ok: false, error: "expired" };
  return { ok: true, payload };
}

