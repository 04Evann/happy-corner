// /api/getPoints.js (Versión Final y Optimizada)

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
    // Buscar al cliente directamente por su código en la API
    const data = await lvFetch(`/customers?filter[customer_code]=${encodeURIComponent(happyCode)}`);
    return data.customers && data.customers[0] ? data.customers[0] : null;
  }

  async function getLastReceiptsForCustomer(customerId, max = 5) {
    try {
      // Usar el filtro de customer_id directamente en la URL para mayor eficiencia
      const url = `/receipts?customer_id=${encodeURIComponent(customerId)}&limit=${max}&order=created_at_desc`;
      const data = await lvFetch(url);

      const out = data.receipts || [];
      
      return out.map(r => ({
        recibo: r.receipt_number,
        fecha: new Date(r.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
        total: r.total_money,
        tienda: r.store_id
      }));

    } catch (error) {
      console.error('Error fetching receipts from Loyverse:', error);
      return [];
    }
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
