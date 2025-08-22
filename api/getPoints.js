// /api/getPoints.js (Versión Final y Corregida)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://happycorner.lol');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { codigo } = req.query;
  if (!codigo) {
    return res.status(400).json({ error: 'Falta el parámetro "codigo"' });
  }

  const token = process.env.LOYVERSE_API_KEY;
  if (!token) {
    return res.status(500).json({ error: 'Falta LOYVERSE_API_KEY en Vercel' });
  }

  const API = 'https://api.loyverse.com/v1.0';

  async function lvFetch(path) {
    const r = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) {
      throw new Error(`Loyverse ${r.status}: ${r.statusText}`);
    }
    return r.json();
  }

  async function findCustomerByCode(happyCode) {
    let cursor = null;
    let pageCount = 0;
    const MAX_PAGES = 100;
    while (pageCount < MAX_PAGES) {
      const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=250` : `?limit=250`;
      const data = await lvFetch(`/customers${q}`);
      const lista = data.customers || [];
      const hit = lista.find(c => c.customer_code === happyCode);
      if (hit) {
        return hit;
      }
      cursor = data.cursor;
      if (!cursor) {
        break;
      }
      pageCount++;
    }
    return null;
  }

  async function getLastReceiptsForCustomer(customerId, max = 5) {
    const receipts = [];
    let cursor = null;
    
    // Bucle para obtener las últimas ventas, optimizado para ser robusto
    while (receipts.length < max) {
      const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=200&order=created_at_desc` : `?limit=200&order=created_at_desc`;
      const data = await lvFetch(`/receipts${q}`);
      
      const newReceipts = data.receipts || [];
      
      // Itera sobre los nuevos recibos para encontrar los del cliente
      for (const r of newReceipts) {
        if (r.customer_id === customerId) {
          receipts.push({
            recibo: r.receipt_number,
            fecha: new Date(r.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
            total: r.total_money,
            tienda: r.store_id
          });
        }
        if (receipts.length >= max) {
          break; // Salimos del bucle si ya tenemos suficientes recibos
        }
      }

      cursor = data.cursor;
      if (!cursor || newReceipts.length === 0) {
        break; // No hay más páginas o ventas
      }
    }
    return receipts;
  }

  try {
    const cliente = await findCustomerByCode(codigo);
    if (!cliente) {
      return res.status(404).json({ error: 'HappyCódigo no encontrado. Por favor, verifica el código.' });
    }

    const receipts = await getLastReceiptsForCustomer(cliente.id, 5);

    res.status(200).json({
      nombre: cliente.name,
      happyCodigo: cliente.customer_code,
      correo: cliente.email || 'No registrado',
      puntos: cliente.total_points,
      ultimas_transacciones: receipts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando Loyverse. Por favor, inténtalo de nuevo.' });
  }
}
