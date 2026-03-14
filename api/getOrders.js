// ... dentro de la lógica del POST en api/getOrders.js
if (method === 'POST') {
    // 1. Guardas en Supabase (lo que ya tenemos)
    const { data, error } = await supabase.from('pedidos').insert([pedidoData]);

    // 2. NUEVO: Alerta inmediata a tu Telegram
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: `🔔 ¡NUEVO PRE-ORDER! 🔔\n\n👤 Cliente: ${pedidoData.nombre}\n📦 Pedido: ${pedidoData.resumen}\n💰 Total: ${pedidoData.total}\n📱 WA: https://wa.me/${pedidoData.whatsapp}`
        })
    });
    
    return res.status(200).json({ ok: true });
}
