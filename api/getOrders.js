import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET);

export default async function handler(req, res) {
    // --- SOLUCIÓN AL ERROR DE CORS ---
    // Esto permite que happycorner.lol hable con la API de Vercel
    res.setHeader('Access-Control-Allow-Origin', 'https://happycorner.lol'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejar la petición "preflight" (OPTIONS) que hace el navegador
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { method, body, query } = req;

    try {
        // --- GUARDAR PEDIDO Y ENVIAR A TELEGRAM ---
        if (method === 'POST') {
            const pedidoData = body;

            // 1. Guardar en Supabase
            const { data, error } = await supabase.from('pedidos').insert([pedidoData]);
            if (error) throw error;

            // 2. Enviar notificación a Telegram (Tu aviso rápido)
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: process.env.TELEGRAM_CHAT_ID,
                    text: `🔔 ¡NUEVO PRE-ORDER! 🔔\n\n👤 Cliente: ${pedidoData.nombre}\n📦 Pedido: ${pedidoData.resumen}\n💰 Total: ${pedidoData.total}\n📱 WhatsApp: https://wa.me/${pedidoData.whatsapp}`
                })
            });

            return res.status(200).json({ ok: true });
        }

        // --- LÓGICA DE LECTURA (GET) ---
        if (method === 'GET') {
            // (Aquí va tu lógica de admin que ya teníamos para ver pedidos)
            let dbQuery = supabase.from('pedidos').select('*').order('id', { ascending: false });
            const { data } = await dbQuery;
            return res.status(200).json(data);
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
}
