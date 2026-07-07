import { db } from './_lib/firebaseAdmin.js';
import { addMovement } from './_lib/movementsHelper.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

    // Secret verification
    const secret = req.headers['authorization'] || req.body.secret;
    const MI_STRING_SECRETO = process.env.DEUDAS_SECRET || "happycorner-secreto-12345";
    
    if (secret !== MI_STRING_SECRETO) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    try {
        const { accion, nombre, monto, detalle } = req.body;
        // accion = 'NUEVA', 'PAGAR', 'DEUDORES'
        
        let nombreClean = nombre ? nombre.trim().toLowerCase() : '';

        // Helper to find a user by matching their name
        async function findUserByName(searchStr) {
            if (!searchStr) return null;
            const usersSnap = await db.collection('users').get();
            const matches = [];
            usersSnap.forEach(doc => {
                const u = doc.data();
                const fullName = (u.displayName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || '').toLowerCase();
                if (fullName.includes(searchStr) || searchStr.includes(fullName)) {
                    matches.push({ uid: doc.id, data: u, fullName });
                }
            });
            return matches;
        }

        // 1. OBTENER LISTA DE DEUDORES
        if (accion === 'DEUDORES') {
            const snapshot = await db.collection('users')
                .where('activeDebt', '>', 0)
                .get();

            if (snapshot.empty) {
                return res.status(200).json({ msg: "💸 ¡Nadie te debe dinero! Todo limpio." });
            }

            let texto = "🔥 LISTA DE DEUDAS:\n\n";
            const rawNames = [];
            snapshot.forEach(doc => {
                const u = doc.data();
                const displayName = u.displayName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Estudiante';
                // Capitalize name
                let name = displayName.split(' ')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                    .join(' ');
                texto += `👤 ${name}: $${u.activeDebt}\n`;
                rawNames.push(name);
            });
            return res.status(200).json({ msg: texto, rawNames: rawNames });
        }

        // 2. NUEVA DEUDA (Punto de Venta - POS)
        if (accion === 'NUEVA') {
            const abonoFijo = req.body.abono ? parseInt(req.body.abono) : 0;
            const productosString = req.body.productos || req.body.detalle || ""; // ej: "Pizza, Bubbaloo"
            
            if (!nombre) return res.status(400).json({ msg: "🔴 Falta nombre." });

            // Find user
            const matches = await findUserByName(nombreClean);
            if (!matches || matches.length === 0) {
                return res.status(200).json({ msg: `🧐 No encontré a "${nombre}" en la lista de usuarios. Por favor regístralo primero.` });
            }
            if (matches.length > 1) {
                const namesList = matches.map(m => m.data.displayName || m.data.name || `${m.data.firstName || ''} ${m.data.lastName || ''}`.trim()).join(', ');
                return res.status(200).json({ msg: `🧐 Múltiples coincidencias para "${nombre}": [${namesList}]. Sé más específico.` });
            }

            const targetUser = matches[0];

            // Calculate product sums from catalog
            let sumMonto = 0;
            if (monto && parseInt(monto) > 0) {
                sumMonto = parseInt(monto);
            } else if (typeof productosString === 'string' || Array.isArray(productosString)) {
                let prodArray = Array.isArray(productosString) ? productosString : productosString.split(',');
                const { getPriceByName } = await import('./_lib/catalog.js');
                prodArray.forEach(p => {
                    sumMonto += getPriceByName(p.trim());
                });
            }

            let debtFinal = sumMonto - abonoFijo;
            let strProductos = Array.isArray(productosString) ? productosString.join(', ') : productosString;

            if (debtFinal <= 0) {
                return res.status(200).json({ msg: `✅ Cobro completo de contado. Total: $${sumMonto}. \n¡Cambio a devolver: $${Math.abs(debtFinal)}!` });
            }

            // Create purchase movement
            const description = abonoFijo > 0 
                ? `${strProductos} (Abonado $${abonoFijo} en compra)`
                : strProductos;
                
            await addMovement(targetUser.uid, {
                type: 'purchase',
                amount: debtFinal,
                description: description
            });

            // Read updated user to display final balance
            const updatedSnap = await db.collection('users').doc(targetUser.uid).get();
            const updatedUser = updatedSnap.data();

            return res.status(200).json({ 
                msg: `✅ Se agregaron los productos a ${targetUser.data.displayName || targetUser.data.name}.\nTotal Comprado: $${sumMonto}\nAbono: $${abonoFijo}\nSe sumó $${debtFinal} a su deuda.\n💰 NUEVA DEUDA TOTAL: $${updatedUser.activeDebt}` 
            });
        }

        // 3. PAGAR DEUDA
        if (accion === 'PAGAR') {
            if (!nombre || !monto) return res.status(400).json({ msg: "🔴 Falta nombre o monto a restar." });
            let restMonto = parseInt(monto);

            const matches = await findUserByName(nombreClean);
            if (!matches || matches.length === 0) {
                return res.status(200).json({ msg: `🧐 No encontré a "${nombre}" en la lista de deudores.` });
            }
            if (matches.length > 1) {
                const namesList = matches.map(m => m.data.displayName || m.data.name || `${m.data.firstName || ''} ${m.data.lastName || ''}`.trim()).join(', ');
                return res.status(200).json({ msg: `🧐 Múltiples coincidencias para "${nombre}": [${namesList}]. Sé más específico.` });
            }

            const targetUser = matches[0];

            // Create payment movement (negative amount)
            await addMovement(targetUser.uid, {
                type: 'payment',
                amount: -restMonto,
                description: detalle || 'Abono / Pago de deuda'
            });

            // Read updated user to check remaining balance
            const updatedSnap = await db.collection('users').doc(targetUser.uid).get();
            const updatedUser = updatedSnap.data();

            if (updatedUser.activeDebt <= 0) {
                 return res.status(200).json({ msg: `🎉 ¡${targetUser.data.displayName || targetUser.data.name} ha pagado toda su deuda! Saldo en 0.` });
            } else {
                 return res.status(200).json({ msg: `✅ Se restó $${restMonto}. ${targetUser.data.displayName || targetUser.data.name} aún debe: $${updatedUser.activeDebt}` });
            }
        }

        return res.status(400).json({ msg: 'Acción no válida' });

    } catch (e) {
        console.error(e);
        return res.status(500).json({ msg: `Error interno: ${e.message}` });
    }
}
