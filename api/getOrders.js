import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const { method, query } = req;

    try {
        // --- ESTADÍSTICAS DE GANANCIAS ---
        if (query.stats) {
            const now = new Date();
            const startOfDay = new Date(now.setHours(0,0,0,0)).toISOString();
            
            const { data: hoy } = await supabase.from('pedidos').select('total').eq('estado', 'Entregado').gte('created_at', startOfDay);
            const { data: todos } = await supabase.from('pedidos').select('total, created_at').eq('estado', 'Entregado');

            return res.status(200).json({ hoy, todos });
        }

        // --- ELIMINAR MENSAJE TELEGRAM ---
        if (query.deleteMsg && query.msgId) {
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteMessage?chat_id=${process.env.TELEGRAM_CHAT_ID}&message_id=${query.msgId}`);
            return res.status(200).json({ ok: true });
        }

        // --- CONSULTA LOYVERSE ---
        if (query.phone) {
            const lvRes = await fetch(`https://api.loyverse.com/v2/customers?phone_number=${encodeURIComponent(query.phone)}`, {
                headers: { 'Authorization': `Token ${process.env.LOYVERSE_API_KEY}` }
            });
            const lvData = await lvRes.json();
            return res.status(200).json(lvData.customers?.[0] || { points: 0 });
        }

        // --- LISTAR PEDIDOS ---
        let dbQuery = supabase.from('pedidos').select('*').order('id', { ascending: false });
        if (query.search) dbQuery = dbQuery.or(`nombre.ilike.%${query.search}%,whatsapp.ilike.%${query.search}%`);
        
        const { data, error } = await dbQuery;
        if (error) throw error;
        res.status(200).json(data);

    } catch (e) { res.status(500).json({ error: e.message }); }
}
