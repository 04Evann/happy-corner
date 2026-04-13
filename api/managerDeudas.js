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

        // 2. NUEVA DEUDA (Punto de Venta - POS)
        if (accion === 'NUEVA') {
            const abonoFijo = req.body.abono ? parseInt(req.body.abono) : 0;
            const productosString = req.body.productos || req.body.detalle || ""; // ej: "Pizza, Bubbaloo"
            
            if (!nombre) return res.status(400).json({ msg: "🔴 Falta nombre." });

            // Calcular suma de productos desde el Catálogo
            // Importación dinámica limpia (ya que este archivo es serverless, pero Next soporta imports arriba. Lo movemos arriba)
            let sumMonto = 0;
            // req.body.monto (opcional si mandan precio manual en vez de productos)
            if (monto && parseInt(monto) > 0) {
                sumMonto = parseInt(monto);
            } else if (typeof productosString === 'string' || Array.isArray(productosString)) {
                // Si es un array desde Shortcuts o un string separado por comas
                let prodArray = Array.isArray(productosString) ? productosString : productosString.split(',');
                // Import the catlog module internally to avoid breaking old handler if moving things
                // Since we need to read from file, let's fetch it via HTTP from ourselves or just do dynamic import
                const { getPriceByName } = await import('./_lib/catalog.js');
                prodArray.forEach(p => {
                    sumMonto += getPriceByName(p.trim());
                });
            }

            let deudaFinal = sumMonto - abonoFijo;
            let strProductos = Array.isArray(productosString) ? productosString.join(', ') : productosString;

            // Si el monto quedó en 0 o negativo porque pagó todo de contado!
            if (deudaFinal <= 0) {
                // Registrarlo tal vez como venta normal o decirle que todo okay sin deuda
                return res.status(200).json({ msg: `✅ Cobro completo de contado. Total: $${sumMonto}. \n¡Cambio a devolver: $${Math.abs(deudaFinal)}!` });
            }
            
            // Buscar si ya existe el deudor
            const users = await supabaseFetch(`deudas?nombre=eq.${encodeURIComponent(nombreClean)}`);
            if (users && users.length > 0) {
                const existing = users[0];
                const newMonto = parseInt(existing.monto) + deudaFinal;
                const newDetalle = existing.detalle ? `${existing.detalle}, ${strProductos}` : strProductos;
                await supabaseFetch(`deudas?id=eq.${existing.id}`, 'PATCH', { monto: newMonto, detalle: newDetalle });
                return res.status(200).json({ msg: `✅ Se agregaron los productos.\nTotal Comprado: $${sumMonto}\nAbono: $${abonoFijo}\nSe sumó $${deudaFinal} a su deuda.\n💰 NUEVA DEUDA TOTAL: $${newMonto}` });
            } else {
                await supabaseFetch(`deudas`, 'POST', { nombre: nombreClean, monto: deudaFinal, detalle: strProductos });
                return res.status(200).json({ msg: `✅ Deuda Creada.\nTotal Comprado: $${sumMonto}\nAbono: $${abonoFijo}\n💰 DEBE: $${deudaFinal}` });
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
