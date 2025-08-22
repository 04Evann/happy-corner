export default async function handler(req, res) {
  const { codigo } = req.query;
  const token = process.env.LOYVERSE_API_KEY;

  if (!codigo) {
    return res.status(400).json({ error: "Falta el código del cliente" });
  }

  try {
    const response = await fetch(
      `https://api.loyverse.com/v1.0/customers?customer_code=${codigo}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!data.customers || data.customers.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const customer = data.customers[0];

    res.status(200).json({
      nombre: customer.name,
      codigo: customer.customer_code,
      puntos: customer.points,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
