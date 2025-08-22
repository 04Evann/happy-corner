export default async function handler(req, res) {
  const { codigo } = req.query;
  const token = process.env.LOYVERSE_API_KEY;

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

    if (data.customers && data.customers.length > 0) {
      const customer = data.customers[0];

      res.status(200).json({
        codigo: customer.customer_code,
        nombre: customer.name,
        puntos: customer.points,
      });
    } else {
      res.status(404).json({ error: "Cliente no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor" });
  }
}
