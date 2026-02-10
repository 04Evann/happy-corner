import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const { method, query } = req;

    try {
        // --- CONSULTA LOYVERSE (Puntos del Cliente) ---
        if (method === 'GET' && query.phone) {
            const lvRes = await fetch(`https://api.loyverse.com/v2/customers?phone_number=${query.phone}`, {
                headers: { 'Authorization': `Token ${process.env.LOYVERSE_API_KEY}` }
            });
            const lvData = await lvRes.json();
            return res.status(200).json(lvData.customers?.[0] || { points: 0, name: "Nuevo" });
        }

        // --- ACCIONES SOBRE PEDIDOS ---
        if (method === 'POST' && query.id && query.estado) {
            await supabase.from('pedidos').update({ estado: query.estado }).eq('id', query.id);
            return res.status(200).json({ ok: true });
        }

        if (method === 'DELETE' && query.id) {
            await supabase.from('pedidos').delete().eq('id', query.id);
            return res.status(200).json({ ok: true });
        }

        // --- LISTAR PEDIDOS CON FILTROS ---
        let dbQuery = supabase.from('pedidos').select('*');
        if (query.search) dbQuery = dbQuery.or(`nombre.ilike.%${query.search}%,whatsapp.ilike.%${query.search}%`);
        
        // Ordenamiento MD3
        if (query.sort === 'price_desc') dbQuery = dbQuery.order('total', { ascending: false });
        else dbQuery = dbQuery.order('id', { ascending: false });

        const { data, error } = await dbQuery;
        if (error) throw error;
        res.status(200).json(data);

    } catch (e) { res.status(500).json({ error: e.message }); }
}
