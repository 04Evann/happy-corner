export default async function handler(req, res) {
  try {
    const { codigo } = req.query;

    if (!codigo) {
      return res.status(400).json({ error: "Falta el código del cliente" });
    }

    // 1. Buscar cliente por Customer Code
    const clienteResp = await fetch(
      `https://api.loyverse.com/v1.0/customers?search=${codigo}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.LOYVERSE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const clienteData = await clienteResp.json();

    if (!clienteData.customers || clienteData.customers.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const cliente = clienteData.customers[0];

    // 2. Retornar datos del cliente (incluye puntos)
    return res.status(200).json({
      nombre: cliente.name,
      codigo: cliente.customer_code,
      puntos: cliente.total_points,
      email: cliente.email,
      telefono: cliente.phone_number,
    });
  } catch (err) {
    console.error("Error Loyverse:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
