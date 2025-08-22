// /api/getPoints.js (Versión Corregida)

// ... (todo lo que está antes de esta función)

async function getLastReceiptsForCustomer(customerId, max = 5) {
  try {
    const receiptsResponse = await fetch(`https://api.loyverse.com/v1.0/receipts?customer_id=${customerId}&limit=${max}&order=created_at_desc`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!receiptsResponse.ok) {
      throw new Error(`Loyverse ${receiptsResponse.status}: ${receiptsResponse.statusText}`);
    }

    const data = await receiptsResponse.json();
    const out = data.receipts || [];

    return out.map(r => ({
      recibo: r.receipt_number,
      fecha: new Date(r.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
      total: r.total_money
    }));

  } catch (error) {
    console.error('Error fetching receipts from Loyverse:', error);
    return [];
  }
}

// ... (todo lo que está después de esta función)
