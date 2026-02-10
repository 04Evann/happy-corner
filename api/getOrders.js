import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

    const { method, query } = req;

    try {
        // --- ELIMINAR MENSAJE DE TELEGRAM (Seguridad) ---
        if (query.action === 'cleanTG' && query.msgId) {
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteMessage?chat_id=${process.env.TELEGRAM_CHAT_ID}&message_id=${query.msgId}`);
            return res.status(200).json({ ok: true });
        }

        // --- LÓGICA DE ESTADOS Y PAPELERA ---
        if (method === 'POST' && query.id && query.estado) {
            let updateData = { estado: query.estado };
            if (['Cancelado', 'Entregado'].includes(query.estado)) {
                let expiry = new Date();
                expiry.setDate(expiry.getDate() + 30);
                updateData.deleted_at = expiry.toISOString();
            } else {
                updateData.deleted_at = null;
            }
            await supabase.from('pedidos').update(updateData).eq('id', query.id);
            return res.status(200).json({ ok: true });
        }

        // --- FILTROS DE VISTA (Día específico, Mes, etc) ---
        let dbQuery = supabase.from('pedidos').select('*');
        
        if (query.date) {
            dbQuery = dbQuery.gte('created_at', `${query.date}T00:00:00`).lte('created_at', `${query.date}T23:59:59`);
        } else if (query.view === 'active') {
            dbQuery = dbQuery.is('deleted_at', null);
        } else if (query.view === 'trash') {
            dbQuery = dbQuery.not('deleted_at', 'is', null).eq('estado', 'Cancelado');
        }

        const { data, error } = await dbQuery.order('id', { ascending: false });
        if (error) throw error;
        res.status(200).json(data);

    } catch (e) { res.status(500).json({ error: e.message }); }
}
