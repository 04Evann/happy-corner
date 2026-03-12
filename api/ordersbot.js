import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import { applyCors, json, readJsonBody, requireEnv } from "./_lib/http.js";

const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE_ROLE_KEY || process.env.SB_SECRET;
const supabase = createClient(SB_URL, SB_KEY);

export default async function handler(req, res) {
  if (applyCors(req, res, { methods: ["POST", "OPTIONS"] })) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    requireEnv("SB_URL");
    if (!process.env.SB_SERVICE_ROLE_KEY) requireEnv("SB_SECRET");
    requireEnv("TELEGRAM_TOKEN");
    requireEnv("TELEGRAM_CHAT_ID");

    const { nombre, whatsapp, resumen, total, metodo_pago, happycodigo } = readJsonBody(req);
    const fecha = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

    if (!nombre || !whatsapp || !resumen || !total || !metodo_pago) {
      return json(res, 400, { ok: false, error: "Faltan datos del pedido" });
    }

    const { data, error } = await supabase
      .from("pedidos")
      .insert([
        {
          nombre,
          whatsapp,
          resumen,
          total,
          metodo_pago,
          happycodigo: happycodigo || "Sin código",
          estado: "Nuevo",
        },
      ])
      .select()
      .single();

    if (error) throw error;

    const msg =
      `📦 NUEVO PEDIDO #${data.id}\n\n` +
      `👤 ${nombre}\n` +
      `📱 ${whatsapp}\n` +
      `💳 Pago: ${metodo_pago}\n` +
      `🎟️ Ticket: ${happycodigo || "Sin codigo"} (HAPPYCODIGO)\n\n` +
      `🛒 ${resumen}\n` +
      `💰 TOTAL: ${total}\n\n` +
      `🕒 ${fecha}\n\n` +
      `Toca para procesar:\n` +
      `/confirmar_${data.id}\n` +
      `/entregar_${data.id}\n` +
      `/cancelar_${data.id}`;

    try {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: msg,
        }),
      });
    } catch (tgErr) {
      console.error("ordersbot: Telegram send failed:", tgErr?.message || tgErr);
    }

    return json(res, 200, { ok: true, orderId: data.id });
  } catch (err) {
    const message = err?.message || String(err);
    console.error("Error en ordersbot:", message);
    return json(res, 500, { ok: false, error: "Error procesando pedido", details: message });
  }
}
