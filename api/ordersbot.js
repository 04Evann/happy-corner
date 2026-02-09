import { Telegraf, Markup } from "telegraf";
import { generarFactura } from "./factura.js";
import fs from "fs";

const bot = new Telegraf(process.env.BOT_TOKEN);

// MEMORIA DEL BOT
const pedidos = new Map();

function now() {
  return new Date().toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

// API DESDE LA WEB
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    nombre,
    whatsapp,
    resumen,
    total,
    metodo_pago,
    happycodigo
  } = req.body;

  const codigo = Math.floor(100 + Math.random() * 900).toString();

  const productos = resumen.split(",").map(p => {
    const match = p.match(/(.+)\s\(x(\d+)\)/);
    return {
      nombre: match ? match[1] : p,
      qty: match ? Number(match[2]) : 1,
      precio: 0
    };
  });

  const pedido = {
    codigo,
    nombre,
    telefono: whatsapp,
    productos,
    metodoPago: metodo_pago,
    happycodigo,
    estado: "nuevo",
    createdAt: now()
  };

  pedidos.set(codigo, pedido);

  await bot.telegram.sendMessage(
    process.env.TELEGRAM_CHAT_ID,
    `🛒 *Nuevo pedido*\n\n` +
    `👤 ${nombre}\n` +
    `📦 Pedido #${codigo}\n` +
    `💰 ${total}\n` +
    `💳 ${metodo_pago}\n` +
    `🕒 ${pedido.createdAt}`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Confirmar", `confirmar_${codigo}`),
          Markup.button.callback("❌ Cancelar", `cancelar_${codigo}`)
        ]
      ])
    }
  );

  res.status(200).json({ ok: true, codigo });
}

// BOTONES
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const [accion, codigo] = data.split("_");
  const pedido = pedidos.get(codigo);

  if (!pedido) {
    return ctx.reply("❌ Pedido no encontrado");
  }

  if (accion === "confirmar") {
    pedido.estado = "confirmado";
    pedido.confirmedAt = now();

    await ctx.reply(
      `✅ Pedido ${codigo} confirmado\n` +
      `🕒 ${pedido.confirmedAt}\n\n` +
      `/entregar ${codigo}`
    );
  }

  if (accion === "cancelar") {
    pedido.estado = "cancelado";

    const msg =
      `Hola ${pedido.nombre}, tu pedido fue cancelado ❌`;

    const wpp = `https://wa.me/${pedido.telefono}?text=${encodeURIComponent(msg)}`;

    await ctx.reply(
      `❌ Pedido ${codigo} cancelado`,
      Markup.inlineKeyboard([
        [Markup.button.url("Avisar por WhatsApp", wpp)]
      ])
    );
  }

  ctx.answerCbQuery();
});

// ENTREGAR
bot.command("entregar", async (ctx) => {
  const codigo = ctx.message.text.split(" ").pop();
  const pedido = pedidos.get(codigo);

  if (!pedido) return ctx.reply("❌ Pedido no existe");

  pedido.estado = "entregado";
  pedido.deliveredAt = now();

  const facturaPath = generarFactura(pedido);

  await ctx.reply(`📦 Pedido ${codigo} entregado`);
  await ctx.replyWithDocument({
    source: fs.createReadStream(facturaPath),
    filename: `Factura-HC-${codigo}.pdf`
  });

  const mensaje =
    `Hola ${pedido.nombre} 👋\n` +
    `Tu pedido fue entregado 🍬\n` +
    `Gracias por comprar en Happy Corner 💚\n` +
    `📦 Pedido #${codigo}\n` +
    `🕒 ${pedido.deliveredAt}`;

  const wpp = `https://wa.me/${pedido.telefono}?text=${encodeURIComponent(mensaje)}`;

  await ctx.reply(
    "📲 Avisar al cliente:",
    Markup.inlineKeyboard([
      [Markup.button.url("Abrir WhatsApp", wpp)]
    ])
  );
});

bot.launch();
