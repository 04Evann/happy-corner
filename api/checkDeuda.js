import { supabaseFetch } from './_lib/supabase.js';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { nombre } = req.query;
        if (!nombre) return res.status(200).json({ hasDeuda: false });

        let searchName = nombre.trim().toLowerCase();

        // Busqueda exacta o que contenga la palabra (usando ilike)
        // Usamos eq si queremos exacto, pero ilike sirve para coincidencias. 
        // Supabase REST usa ?nombre=ilike.*searchName*, pero para simplificar
        // buscaremos exacto, o sacamos la lista y filtramos en Node para mayor control de similitud.
        
        const data = await supabaseFetch(`deudas?monto=gt.0&select=nombre,monto,detalle`);
        
        if (!data || data.length === 0) {
            return res.status(200).json({ hasDeuda: false });
        }

        // Buscamos manualmente en node (rápido ya que no serán miles)
        // si el nombre escrito en el input está contenido o contiene alguno de los deudores
        let match = data.find(d => {
            let n = d.nombre.toLowerCase();
            return searchName.includes(n) || n.includes(searchName);
        });

        if (match) {
            // Capitalizamos
            let capitalizedName = match.nombre.charAt(0).toUpperCase() + match.nombre.slice(1);
            return res.status(200).json({ 
                hasDeuda: true, 
                deudorData: {
                    nombre: capitalizedName,
                    monto: match.monto,
                    detalle: match.detalle || "Pendientes"
                }
            });
        }

        return res.status(200).json({ hasDeuda: false });
    } catch (e) {
        console.error("Error checkDeuda:", e.message);
        res.status(500).json({ error: e.message });
    }
}
