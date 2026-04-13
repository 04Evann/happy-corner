import { supabaseFetch } from './_lib/supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

    // String secreto oculto
    const secret = req.headers['authorization'] || req.body.secret;
    const MI_STRING_SECRETO = process.env.DEUDAS_SECRET || "happycorner-secreto-12345";
    
    if (secret !== MI_STRING_SECRETO) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    try {
        const { accion, nombre, monto, detalle } = req.body;
        // accion = 'NUEVA', 'PAGAR', 'DEUDORES'
        
        let nombreClean = nombre ? nombre.trim().toLowerCase() : '';

        // 1. OBTENER LISTA DE DEUDORES
        if (accion === 'DEUDORES') {
            const data = await supabaseFetch(`deudas?monto=gt.0&select=nombre,monto`);
            if (!data || data.length === 0) {
                return res.status(200).json({ msg: "💸 ¡Nadie te debe dinero! Todo limpio." });
            }
            let texto = "🔥 LISTA DE DEUDAS:\n\n";
            let rawNames = [];
            data.forEach(d => {
                // Capitalizar primera letra
                let name = d.nombre.charAt(0).toUpperCase() + d.nombre.slice(1);
                texto += `👤 ${name}: $${d.monto}\n`;
                rawNames.push(name);
            });
            return res.status(200).json({ msg: texto, rawNames: rawNames });
        }

        // 2. NUEVA DEUDA
        if (accion === 'NUEVA') {
            if (!nombre || !monto) return res.status(400).json({ msg: "🔴 Falta nombre o monto." });
            let sumMonto = parseInt(monto);
            
            // Buscar si ya existe
            const users = await supabaseFetch(`deudas?nombre=eq.${encodeURIComponent(nombreClean)}`);
            if (users && users.length > 0) {
                const existing = users[0];
                const newMonto = parseInt(existing.monto) + sumMonto;
                const newDetalle = existing.detalle ? `${existing.detalle}, ${detalle}` : detalle;
                await supabaseFetch(`deudas?id=eq.${existing.id}`, 'PATCH', { monto: newMonto, detalle: newDetalle });
                return res.status(200).json({ msg: `✅ Se sumó $${sumMonto} a la deuda de ${nombreClean}. Deuda actual: $${newMonto}` });
            } else {
                await supabaseFetch(`deudas`, 'POST', { nombre: nombreClean, monto: sumMonto, detalle });
                return res.status(200).json({ msg: `✅ Se creó la deuda de $${sumMonto} para ${nombreClean}.` });
            }
        }

        // 3. PAGAR DEUDA
        if (accion === 'PAGAR') {
            if (!nombre || !monto) return res.status(400).json({ msg: "🔴 Falta nombre o monto a restar." });
            let restMonto = parseInt(monto);

            const users = await supabaseFetch(`deudas?nombre=eq.${encodeURIComponent(nombreClean)}`);
            if (users && users.length > 0) {
                const existing = users[0];
                const newMonto = parseInt(existing.monto) - restMonto;
                if (newMonto <= 0) {
                     // Deuda saldada, se puede eliminar o dejar en 0
                     await supabaseFetch(`deudas?id=eq.${existing.id}`, 'PATCH', { monto: 0, detalle: "Saldado" });
                     return res.status(200).json({ msg: `🎉 ¡${nombreClean} te ha pagado todo! Deuda en 0.` });
                } else {
                     await supabaseFetch(`deudas?id=eq.${existing.id}`, 'PATCH', { monto: newMonto });
                     return res.status(200).json({ msg: `✅ Se restó $${restMonto}. ${nombreClean} aún debe: $${newMonto}` });
                }
            } else {
                return res.status(200).json({ msg: `🧐 No encontré a ${nombreClean} en la lista de deudores.` });
            }
        }

        return res.status(400).json({ msg: 'Acción no válida' });

    } catch (e) {
        console.error(e);
        return res.status(500).json({ msg: `Error interno: ${e.message}` });
    }
}
