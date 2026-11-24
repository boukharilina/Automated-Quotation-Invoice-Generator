import ExcelJS from "exceljs";
import { route } from "@/lib/api";
import { filteredInvoices, filteredPayments, parseFilters, dashboard } from "@/lib/reports";
import { getSettings } from "@/lib/settings";
import { renderReport } from "@/lib/pdf";
import { fmt } from "@/lib/money";
import { fmtDate, INVOICE_STATUS, METHODS, today } from "@/lib/util";

export const GET = route("export", async (req) => {
  const url = new URL(req.url);
  const f = parseFilters(url.searchParams);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const [invoices, payments, stats, s] = await Promise.all([filteredInvoices(f), filteredPayments(f), dashboard(f), getSettings()]);

  if (format === "pdf") {
    const sub = `Édité le ${fmtDate(today())}` + (f.from || f.to ? ` · Période : ${f.from ? fmtDate(f.from) : "…"} → ${f.to ? fmtDate(f.to) : "…"}` : "");
    const buf = await renderReport("Rapport des factures", sub,
      [["Factures émises", String(stats.inv.issued)], ["Total HT", fmt(stats.inv.ht)], ["Total TTC", fmt(stats.inv.ttc)], ["Encaissé", fmt(stats.inv.paid)], ["Solde dû", fmt(stats.inv.outstanding)]],
      ["N°", "Date", "Client", "Statut", "Total HT", "Total TTC", "Payé", "Reste"], [14, 11, 26, 16, 14, 14, 14, 14],
      invoices.map((i) => [i.number, fmtDate(i.issue_date), i.customer_name, INVOICE_STATUS[i.status], fmt(i.total_ht), fmt(i.total_ttc), fmt(i.amount_paid), fmt(i.total_ttc - i.amount_paid)]), s);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="rapport-factures-${today()}.pdf"` } });
  }

  const wb = new ExcelJS.Workbook(); wb.creator = s.company_name;
  const style = (ws: ExcelJS.Worksheet) => { ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14306B" } }; ws.views = [{ state: "frozen", ySplit: 1 }]; };
  const w1 = wb.addWorksheet("Factures");
  w1.columns = [
    { header: "N° facture", key: "number", width: 16 }, { header: "Date", key: "date", width: 12 }, { header: "Échéance", key: "due", width: 12 },
    { header: "Client", key: "cust", width: 28 }, { header: "Services", key: "svc", width: 40 }, { header: "Statut", key: "status", width: 20 },
    { header: "Total HT", key: "ht", width: 14, style: { numFmt: "#,##0.000" } }, { header: "TVA", key: "vat", width: 12, style: { numFmt: "#,##0.000" } },
    { header: "Total TTC", key: "ttc", width: 14, style: { numFmt: "#,##0.000" } }, { header: "Payé", key: "paid", width: 14, style: { numFmt: "#,##0.000" } }, { header: "Reste à payer", key: "rest", width: 14, style: { numFmt: "#,##0.000" } },
  ];
  invoices.forEach((i) => w1.addRow({ number: i.number, date: fmtDate(i.issue_date), due: fmtDate(i.due_date), cust: i.customer_name, svc: i.services, status: INVOICE_STATUS[i.status], ht: i.total_ht, vat: i.vat_amount, ttc: i.total_ttc, paid: i.amount_paid, rest: Math.round((i.total_ttc - i.amount_paid) * 1000) / 1000 }));
  if (invoices.length) {
    const n = invoices.length + 1;
    const t = w1.addRow({ number: "TOTAL", ht: { formula: `SUM(G2:G${n})` }, vat: { formula: `SUM(H2:H${n})` }, ttc: { formula: `SUM(I2:I${n})` }, paid: { formula: `SUM(J2:J${n})` }, rest: { formula: `SUM(K2:K${n})` } });
    t.font = { bold: true };
  }
  style(w1);
  const w2 = wb.addWorksheet("Paiements");
  w2.columns = [
    { header: "N° reçu", key: "r", width: 16 }, { header: "Date", key: "d", width: 12 }, { header: "Facture", key: "i", width: 16 }, { header: "Client", key: "c", width: 28 },
    { header: "Mode", key: "m", width: 18 }, { header: "Référence", key: "ref", width: 24 }, { header: "Montant", key: "a", width: 14, style: { numFmt: "#,##0.000" } },
  ];
  payments.forEach((p) => w2.addRow({ r: p.receipt_number, d: fmtDate(p.paid_on), i: p.invoice_number, c: p.customer_name, m: METHODS[p.method], ref: p.reference, a: p.amount }));
  style(w2);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="factures-${today()}.xlsx"` } });
});
