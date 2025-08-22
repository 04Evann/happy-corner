export default async function handler(req, res) {
  const { codigo } = req.query;

  const token = process.env.LOYVERSE_API_KEY; // Variable de entorno en Vercel

  try {
    // Llamada a la API de Loyverse
    const response = await fetch(
      `https://api.loyverse.com/v1.0/customers?customer_code=${codigo}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (data.customers && data.customers.length > 0) {
      const cliente = data.customers[0];
      res.status(200).json({
        nombre: cliente.name,
        puntos: cliente.total_points
      });
    } else {
      res.status(404).json({ error: "HappyCódigo no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error consultando Loyverse" });
  }
}