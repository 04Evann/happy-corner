import PDFDocument from "pdfkit";
import fs from "fs";

export function generarFactura(pedido) {
  if (!fs.existsSync("./facturas")) {
    fs.mkdirSync("./facturas");
  }

  const doc = new PDFDocument({ margin: 40 });
  const path = `./facturas/factura-${pedido.codigo}.pdf`;

  doc.pipe(fs.createWriteStream(path));

  doc.fontSize(24).text("Happy Corner", { align: "left" });
  doc.fontSize(10).text("Factura de venta\n\n");

  doc.fontSize(12);
  doc.text(`Factura #: HC-${pedido.codigo}`);
  doc.text(`Fecha: ${pedido.deliveredAt || pedido.createdAt}`);
  doc.text(`Cliente: ${pedido.nombre}`);
  doc.text(`Metodo de pago: ${pedido.metodoPago}`);
  doc.text(`Estado: ${pedido.estado}`);

  doc.moveDown();
  doc.fontSize(14).text("Detalle del pedido");
  doc.moveDown(0.5);

  let total = 0;

  pedido.productos.forEach(p => {
    const subtotal = p.qty * (p.precio || 0);
    total += subtotal;
    doc.fontSize(11).text(`${p.nombre} x${p.qty}`);
  });

  doc.moveDown();
  doc.fontSize(16).text(`TOTAL: $${total.toLocaleString("es-CO")}`, {
    align: "right"
  });

  doc.moveDown(2);
  doc.fontSize(10).text(
    "Gracias por tu compra 💚\nHappy Corner",
    { align: "center" }
  );

  doc.end();
  return path;
}
