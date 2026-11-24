import PDFDocument from "pdfkit";
import type { Settings } from "./settings";
import { amountInWords, fmt } from "./money";
import { fmtDate, INVOICE_STATUS, METHODS, QUOTE_STATUS } from "./util";

const NAVY = "#14306B", ACCENT = "#E8590C", INK = "#1F2937", MUTED = "#6B7280", LINE = "#D9DEE7", SOFT = "#F3F5FA";
const M = 40, W = 595.28, H = 841.89, CW = W - 2 * M;

type Doc = InstanceType<typeof PDFDocument>;

function start(): { doc: Doc; done: Promise<Buffer> } {
  const doc = new PDFDocument({ size: "A4", margin: M, bufferPages: true, info: { Producer: "EDUTEST Devis & Factures" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  return { doc, done };
}

function drawLogo(doc: Doc, s: Settings, x: number, y: number) {
  if (s.logo.startsWith("data:image/")) {
    try {
      const buf = Buffer.from(s.logo.split(",")[1], "base64");
      doc.image(buf, x, y, { fit: [150, 56] });
      return;
    } catch { /* fall through to wordmark */ }
  }
  doc.roundedRect(x, y + 4, 8, 40, 2).fill(ACCENT);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(28).text(s.company_name.toUpperCase(), x + 16, y + 6, { lineBreak: false });
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Préparation aux tests & accompagnement", x + 16, y + 38, { lineBreak: false });
}

function header(doc: Doc, s: Settings, title: string, number: string, meta: [string, string][]) {
  drawLogo(doc, s, M, M - 4);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(26).text(title, M, M - 2, { width: CW, align: "right" });
  doc.fillColor(ACCENT).fontSize(12).text(number, M, M + 30, { width: CW, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  let y = M + 48;
  for (const [k, v] of meta) { doc.text(`${k} : `, M, y, { width: CW - 90, align: "right", continued: false }); doc.fillColor(INK).font("Helvetica-Bold").text(v, M, y, { width: CW, align: "right" }); doc.font("Helvetica").fillColor(MUTED); y += 13; }
  doc.moveTo(M, 128).lineTo(W - M, 128).lineWidth(1.2).strokeColor(NAVY).stroke();
  return 142;
}

function partyBoxes(doc: Doc, s: Settings, y: number, rightTitle: string, c: { name: string; lines: string[] }) {
  const bw = (CW - 16) / 2, bh = 92;
  const box = (x: number, title: string, name: string, lines: string[]) => {
    doc.roundedRect(x, y, bw, bh, 4).fillColor(SOFT).fill();
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(8).text(title.toUpperCase(), x + 10, y + 8, { width: bw - 20, characterSpacing: 0.8 });
    doc.fillColor(INK).fontSize(11).text(name, x + 10, y + 21, { width: bw - 20, lineBreak: false, ellipsis: true });
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(lines.filter(Boolean).join("\n"), x + 10, y + 37, { width: bw - 20, height: bh - 42, ellipsis: true });
  };
  box(M, "Émetteur", s.company_name, [s.company_address, `Tél : ${s.company_phone}`, s.company_email, s.tax_id]);
  box(M + bw + 16, rightTitle, c.name, c.lines);
  return y + bh + 18;
}

function customerLines(d: any) {
  return [d.customer_student && d.customer_student !== d.customer_name ? `Étudiant(e) : ${d.customer_student}` : "", d.customer_address,
    d.customer_phone ? `Tél : ${d.customer_phone}` : "", d.customer_email, d.customer_cin ? `CIN / Passeport : ${d.customer_cin}` : ""];
}

function newPage(doc: Doc) { doc.addPage(); return M; }

function itemsTable(doc: Doc, y: number, items: any[]) {
  const cols = [{ x: M, w: 250, t: "Désignation", a: "left" }, { x: M + 250, w: 55, t: "Qté", a: "right" }, { x: M + 305, w: 100, t: "Prix unit. HT", a: "right" }, { x: M + 405, w: CW - 405, t: "Total HT", a: "right" }] as const;
  const head = (yy: number) => {
    doc.rect(M, yy, CW, 22).fill(NAVY);
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(9);
    for (const c of cols) doc.text(c.t, c.x + 8, yy + 7, { width: c.w - 16, align: c.a as any, lineBreak: false });
    return yy + 22;
  };
  y = head(y);
  items.forEach((it, i) => {
    doc.font("Helvetica").fontSize(9.5);
    const h = Math.max(24, doc.heightOfString(it.description, { width: cols[0].w - 16 }) + 14);
    if (y + h > 690) { y = head(newPage(doc)); }
    if (i % 2 === 1) doc.rect(M, y, CW, h).fill(SOFT);
    doc.fillColor(INK).text(it.description, cols[0].x + 8, y + 7, { width: cols[0].w - 16 });
    const qty = Number(it.quantity); doc.text(Number.isInteger(qty) ? String(qty) : String(qty).replace(".", ","), cols[1].x + 8, y + 7, { width: cols[1].w - 16, align: "right", lineBreak: false });
    doc.text(fmt(it.unit_price, false), cols[2].x + 8, y + 7, { width: cols[2].w - 16, align: "right", lineBreak: false });
    doc.font("Helvetica-Bold").text(fmt(it.line_total, false), cols[3].x + 8, y + 7, { width: cols[3].w - 16, align: "right", lineBreak: false });
    y += h;
  });
  doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.6).strokeColor(LINE).stroke();
  return y + 12;
}

function totalsBlock(doc: Doc, y: number, d: any, extra: [string, string, boolean?][] = []) {
  const rows: [string, string, boolean?][] = [["Sous-total HT", fmt(d.subtotal_ht)]];
  if (Number(d.discount) > 0) rows.push(["Remise", "- " + fmt(d.discount)]);
  if (Number(d.extra_charges) > 0) rows.push(["Frais additionnels", fmt(d.extra_charges)]);
  rows.push(["Total HT", fmt(d.total_ht)], [`TVA ${Number(d.vat_rate)} %`, fmt(d.vat_amount)]);
  const x = M + CW - 240;
  if (y + rows.length * 18 + 40 + extra.length * 18 > 740) y = newPage(doc);
  for (const [k, v] of rows) {
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(k, x, y, { width: 110, lineBreak: false });
    doc.fillColor(INK).text(v, x + 100, y, { width: 140, align: "right", lineBreak: false }); y += 18;
  }
  doc.roundedRect(x - 6, y - 2, 252, 28, 3).fill(NAVY);
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(11).text("TOTAL TTC", x + 4, y + 7, { lineBreak: false });
  doc.fontSize(12).text(fmt(d.total_ttc), x + 80, y + 6, { width: 160, align: "right", lineBreak: false });
  y += 36;
  for (const [k, v, strong] of extra) {
    doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor(strong ? ACCENT : MUTED).text(k, x, y, { width: 110, lineBreak: false });
    doc.fillColor(strong ? ACCENT : INK).text(v, x + 100, y, { width: 140, align: "right", lineBreak: false }); y += 18;
  }
  return y + 6;
}

function section(doc: Doc, y: number, title: string, body: string, minH = 40) {
  doc.font("Helvetica").fontSize(9);
  const h = doc.heightOfString(body, { width: CW }) + 22;
  if (y + Math.max(h, minH) > 700) y = newPage(doc);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text(title.toUpperCase(), M, y, { characterSpacing: 0.6, lineBreak: false });
  doc.fillColor(INK).font("Helvetica").fontSize(9).text(body, M, y + 13, { width: CW });
  return y + h + 6;
}

function signatures(doc: Doc, y: number, labels: [string, string]) {
  if (y > 650) y = newPage(doc);
  const bw = (CW - 20) / 2, bh = 80;
  y = Math.max(y, 640 - 0);
  if (y + bh > 760) y = newPage(doc);
  labels.forEach((l, i) => {
    const x = M + i * (bw + 20);
    doc.roundedRect(x, y, bw, bh, 4).lineWidth(0.8).strokeColor(LINE).stroke();
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(l, x + 10, y + 8, { width: bw - 20 });
  });
}

function footers(doc: Doc, s: Settings) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const b = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.moveTo(M, H - 52).lineTo(W - M, H - 52).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.fillColor(MUTED).font("Helvetica").fontSize(7.5)
      .text(`${s.company_name} · ${s.company_address} · Tél : ${s.company_phone} · ${s.company_email} · ${s.company_web}`, M, H - 44, { width: CW, align: "center" })
      .text(`${s.tax_id} · ${s.bank_name} · RIB : ${s.rib}`, M, H - 33, { width: CW, align: "center" })
      .text(`Page ${i + 1} / ${range.count}`, M, H - 22, { width: CW, align: "center" });
    doc.page.margins.bottom = b;
  }
}

export async function renderDocument(kind: "quote" | "invoice", d: any, s: Settings): Promise<Buffer> {
  const { doc, done } = start();
  const isQ = kind === "quote";
  let y = header(doc, s, isQ ? "DEVIS" : "FACTURE", d.number,
    isQ ? [["Date d'émission", fmtDate(d.issue_date)], ["Valable jusqu'au", fmtDate(d.valid_until)]]
        : [["Date de facture", fmtDate(d.issue_date)], ["Échéance", fmtDate(d.due_date)], ...(d.quote_number ? [["Réf. devis", d.quote_number] as [string, string]] : [])]);
  y = partyBoxes(doc, s, y, isQ ? "Client" : "Facturé à", { name: d.customer_name, lines: [`Code client : ${d.customer_code}`, ...customerLines(d)] });
  y = itemsTable(doc, y, d.items);
  const paid = Number(d.amount_paid || 0);
  y = totalsBlock(doc, y, d, !isQ && paid > 0 ? [["Déjà réglé", fmt(paid)], ["Reste à payer", fmt(Number(d.total_ttc) - paid), true]] : []);
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9)
    .text(`Arrêté ${isQ ? "le présent devis" : "la présente facture"} à la somme de : ${amountInWords(Number(d.total_ttc))}.`, M, y, { width: CW });
  y = doc.y + 12;
  if (d.notes) y = section(doc, y, "Description / conditions particulières", d.notes);
  if (isQ) {
    y = section(doc, y, "Conditions et modalités de paiement", d.conditions || s.quote_conditions);
    y = section(doc, y, "Validité de l'offre", `Ce devis est valable jusqu'au ${fmtDate(d.valid_until)}. Statut : ${QUOTE_STATUS[d.status] ?? d.status}.`);
    signatures(doc, y, ["Cachet et signature autorisée – EDUTEST", "Bon pour accord – date, signature et mention « lu et approuvé »"]);
  } else {
    y = section(doc, y, "Modalités de règlement",
      `Mode de paiement : ${METHODS[d.payment_method] ?? d.payment_method}\nRéférence de paiement à rappeler : ${d.number}\nBanque : ${s.bank_name}\nRIB : ${s.rib}\n${d.conditions || s.invoice_conditions}`, 60);
    if (d.payments?.length) {
      y = section(doc, y, "Paiements reçus", d.payments.map((p: any) => `${fmtDate(p.paid_on)} · ${METHODS[p.method]} · ${fmt(p.amount)} · ${p.reference || "sans référence"} (${p.receipt_number})`).join("\n"));
    }
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(`Statut : ${INVOICE_STATUS[d.status] ?? d.status}`, M, y, { width: CW, lineBreak: false });
    signatures(doc, y + 14, ["Cachet et signature autorisée – EDUTEST", "Cachet du client (optionnel)"]);
  }
  footers(doc, s);
  doc.end();
  return done;
}

export async function renderReceipt(p: any, s: Settings): Promise<Buffer> {
  const { doc, done } = start();
  let y = header(doc, s, "REÇU DE PAIEMENT", p.receipt_number, [["Date de paiement", fmtDate(p.paid_on)], ["Facture", p.invoice_number]]);
  y = partyBoxes(doc, s, y, "Reçu de", { name: p.customer_name, lines: [`Code client : ${p.customer_code}`, ...customerLines({ ...p, customer_cin: "" })] });
  doc.roundedRect(M, y, CW, 70, 4).fillColor(SOFT).fill();
  doc.fillColor(MUTED).font("Helvetica").fontSize(9).text("MONTANT REÇU", M + 16, y + 14, { characterSpacing: 0.8, lineBreak: false });
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(26).text(fmt(p.amount), M + 16, y + 30, { lineBreak: false });
  y += 88;
  const rows: [string, string][] = [
    ["Mode de paiement", METHODS[p.method] ?? p.method], ["Référence", p.reference || "—"], ["Facture concernée", p.invoice_number],
    ["Total facture TTC", fmt(p.total_ttc)], ["Total réglé à ce jour", fmt(p.paid_to_date)], ["Solde restant", fmt(Number(p.total_ttc) - Number(p.paid_to_date))],
  ];
  for (const [k, v] of rows) {
    doc.moveTo(M, y + 18).lineTo(W - M, y + 18).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(k, M, y + 3, { width: 200, lineBreak: false });
    doc.fillColor(INK).font(k === "Solde restant" ? "Helvetica-Bold" : "Helvetica").text(v, M + 200, y + 3, { width: CW - 200, align: "right", lineBreak: false });
    y += 24;
  }
  y += 10;
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9).text(`Reçu la somme de : ${amountInWords(Number(p.amount))}.`, M, y, { width: CW });
  signatures(doc, doc.y + 30, ["Cachet et signature autorisée – EDUTEST", "Signature du payeur"]);
  footers(doc, s);
  doc.end();
  return done;
}

export async function renderReport(title: string, subtitle: string, summary: [string, string][], head: string[], widths: number[], rows: string[][], s: Settings): Promise<Buffer> {
  const { doc, done } = start();
  drawLogo(doc, s, M, M - 4);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(18).text(title, M, M, { width: CW, align: "right" });
  doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(subtitle, M, M + 24, { width: CW, align: "right" });
  let y = 118;
  const bw = (CW - 12 * (summary.length - 1)) / summary.length;
  summary.forEach(([k, v], i) => {
    const x = M + i * (bw + 12);
    doc.roundedRect(x, y, bw, 44, 4).fillColor(SOFT).fill();
    doc.fillColor(MUTED).font("Helvetica").fontSize(7.5).text(k.toUpperCase(), x + 8, y + 8, { width: bw - 16, lineBreak: false });
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(v, x + 8, y + 22, { width: bw - 16, lineBreak: false });
  });
  y += 62;
  const total = widths.reduce((a, b) => a + b, 0), sc = CW / total;
  const draw = (cells: string[], yy: number, bold: boolean, fill?: string) => {
    if (fill) doc.rect(M, yy, CW, 18).fill(fill);
    let x = M;
    cells.forEach((c, i) => {
      const w = widths[i] * sc;
      doc.fillColor(fill === NAVY ? "#fff" : INK).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8)
        .text(c, x + 4, yy + 5, { width: w - 8, lineBreak: false, ellipsis: true, align: /TND|^[\d\s,.-]+$/.test(c) && i > 1 ? "right" : "left" });
      x += w;
    });
  };
  draw(head, y, true, NAVY); y += 18;
  rows.forEach((r, i) => {
    if (y > 770) { doc.addPage(); y = M; draw(head, y, true, NAVY); y += 18; }
    draw(r, y, false, i % 2 ? SOFT : undefined); y += 18;
  });
  footers(doc, s);
  doc.end();
  return done;
}
