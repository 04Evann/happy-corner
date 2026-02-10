// ... (parte de arriba de imports igual)
    const { nombre, whatsapp, resumen, total, metodo_pago, codigo } = req.body;
    const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

    const { data, error } = await supabase
      .from('pedidos')
      .insert([{ nombre, whatsapp, resumen, total, metodo_pago, codigo, estado: 'Nuevo' }])
      .select().single();

    if (error) throw error;

    const msg = `📦 *Nuevo pedido* #${data.id}\n` +
                `👤 ${nombre}\n` +
                `📱 ${whatsapp}\n` +
                `💳 ${metodo_pago || 'No especificado'}\n` +
                `🎟️ ${codigo || 'Sin código'} (HAPPYCODIGO)\n\n` +
                `🛒 ${resumen}\n` +
                `💰 ${total}\n\n` +
                `🕒 ${fecha}\n\n` +
                `*Acciones:* \n` +
                `/confirmar_${data.id}  /entregar_${data.id}  /cancelar_${data.id}`;

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: msg, parse_mode: 'Markdown' })
    });
// ...
