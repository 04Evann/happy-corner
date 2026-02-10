import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

    const { method, query } = req;

    try {
        // --- CAMBIAR ESTADO Y MARCAR PARA ELIMINACIÓN ---
        if (method === 'POST' && query.id && query.estado) {
            let updateData = { estado: query.estado };
            
            // Si va a papelera o completado, marcar fecha de caducidad
            if (['Cancelado', 'Entregado'].includes(query.estado)) {
                let fechaBorrado = new Date();
                fechaBorrado.setDate(fechaBorrado.getDate() + 30);
                updateData.deleted_at = fechaBorrado.toISOString();
            } else {
                updateData.deleted_at = null; // Restaurar si se cambia a "Nuevo"
            }

            await supabase.from('pedidos').update(updateData).eq('id', query.id);
            return res.status(200).json({ ok: true });
        }

        // --- OBTENER DATOS SEGÚN SECCIÓN ---
        let dbQuery = supabase.from('pedidos').select('*');

        if (query.view === 'active') dbQuery = dbQuery.is('deleted_at', null);
        if (query.view === 'trash') dbQuery = dbQuery.not('deleted_at', 'is', null).eq('estado', 'Cancelado');
        if (query.view === 'completed') dbQuery = dbQuery.not('deleted_at', 'is', null).eq('estado', 'Entregado');

        const { data, error } = await dbQuery.order('id', { ascending: false });
        if (error) throw error;
        res.status(200).json(data);

    } catch (e) { res.status(500).json({ error: e.message }); }
}
