export default async function handler(req, res) {
  // CORS: Permite que tu frontend en GitHub Pages se comunique con este backend en Vercel
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

  // Búsqueda paginada: busca al cliente en todas las páginas de la API
  async function findCustomerByCode(happyCode) {
    let cursor = null;
    let pageCount = 0;
    const MAX_PAGES = 100; // Límite de seguridad
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

  // Obtiene las últimas 5 transacciones del cliente
  async function getLastReceiptsForCustomer(customerId, max = 5) {
    const out = [];
    let cursor = null;
    let pageCount = 0;
    const MAX_PAGES = 200; // Límite de seguridad
    while (pageCount < MAX_PAGES && out.length < max) {
      const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=250&order=created_at_desc` : `?limit=250&order=created_at_desc`;
      const data = await lvFetch(`/receipts${q}`);
      for (const r of (data.receipts || [])) {
        if (r.customer_id === customerId) {
          out.push({
            receipt_number: r.receipt_number,
            created_at: r.created_at,
            total_money: r.total_money,
            store_id: r.store_id
          });
          if (out.length === max) {
            break;
          }
        }
      }
      cursor = data.cursor;
      if (!cursor) {
        break;
      }
      pageCount++;
    }
    return out;
  }

  try {
    const cliente = await findCustomerByCode(codigo);
    if (!cliente) {
      return res.status(404).json({ error: 'HappyCódigo no encontrado' });
    }

    const receipts = await getLastReceiptsForCustomer(cliente.id, 5);

    res.status(200).json({
      nombre: cliente.name,
      happyCodigo: cliente.customer_code,
      puntos: cliente.total_points,
      customer_id: cliente.id,
      ultimas_transacciones: receipts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando Loyverse' });
  }
}
