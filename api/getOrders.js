import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import { applyCors, json } from "./_lib/http.js";
import { requireAdmin } from "./_lib/adminAuth.js";

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET);

export default async function handler(req, res) {
  if (applyCors(req, res, { methods: ["GET", "POST", "OPTIONS"] })) return;
  const { method, query } = req;

  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    if (query.action === "cleanTG" && query.msgId) {
      await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteMessage?chat_id=${process.env.TELEGRAM_CHAT_ID}&message_id=${query.msgId}`
      );
      return json(res, 200, { ok: true });
    }

    if (method === "POST" && query.id && query.estado) {
      let updateData = { estado: query.estado };
      if (["Cancelado", "Entregado"].includes(query.estado)) {
        let expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        updateData.deleted_at = expiry.toISOString();
      } else {
        updateData.deleted_at = null;
      }
      await supabase.from("pedidos").update(updateData).eq("id", query.id);
      return json(res, 200, { ok: true });
    }

    let dbQuery = supabase.from("pedidos").select("*");

    if (query.date) {
      dbQuery = dbQuery.gte("created_at", `${query.date}T00:00:00`).lte("created_at", `${query.date}T23:59:59`);
    } else if (query.view === "active") {
      dbQuery = dbQuery.is("deleted_at", null);
    } else if (query.view === "trash") {
      dbQuery = dbQuery.not("deleted_at", "is", null).eq("estado", "Cancelado");
    }

    const { data, error } = await dbQuery.order("id", { ascending: false });
    if (error) throw error;
    return json(res, 200, data);
  } catch (e) {
    return json(res, 500, { ok: false, error: "Server error" });
  }
}
