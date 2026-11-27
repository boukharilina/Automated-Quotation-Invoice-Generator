import ExcelJS from "exceljs";
import { fmt, fromM, toM } from "./money";
import { renderReport } from "./pdf";
import type { Kind } from "./docs";
import { searchInvoices, searchQuotes } from "./reports";
import { getSettings } from "./settings";
import { fmtDate, INVOICE_STATUS, QUOTE_STATUS, today } from "./util";

/** Export de la liste des devis ou des factures, avec les mêmes filtres (recherche, statut) que l'écran. */
export async function exportList(kind: Kind, sp: URLSearchParams): Promise<Response> {
  const isQ = kind === "quote";
  const q = sp.get("q") ?? "", status = sp.get("status") ?? "";
  const format = sp.get("format") === "pdf" ? "pdf" : "xlsx";
  const labels = isQ ? QUOTE_STATUS : INVOICE_STATUS;
  const [rows, s] = await Promise.all([isQ ? searchQuotes(q, status) : searchInvoices(q, status), getSettings()]);

  // Les factures annulées restent listées mais ne comptent pas dans les totaux.
  const counted = rows.filter((r) => isQ || r.status !== "cancelled");
  const sum = (fn: (r: any) => number) => fromM(counted.reduce((a, r) => a + toM(fn(r)), 0));
  const rest = (r: any) => (r.status === "cancelled" ? 0 : fromM(toM(r.total_ttc) - toM(r.amount_paid)));
  const title = isQ ? "Liste des devis" : "Liste des factures";
  const filename = `${isQ ? "devis" : "factures"}-${today()}.${format}`;
  const headers = (type: string) => ({ "Content-Type": type, "Content-Disposition": `attachment; filename="${filename}"` });

  const columns: { header: string; width: number; money?: boolean; value: (r: any) => string | number; total?: number }[] = [
    { header: "N°", width: 16, value: (r) => r.number },
    { header: "Date", width: 12, value: (r) => fmtDate(r.issue_date) },
    { header: isQ ? "Validité" : "Échéance", width: 12, value: (r) => fmtDate(isQ ? r.valid_until : r.due_date) },
    { header: "Client", width: 28, value: (r) => r.customer_name },
    { header: "Statut", width: 20, value: (r) => labels[r.status] ?? r.status },
    { header: "Total HT", width: 15, money: true, value: (r) => Number(r.total_ht), total: sum((r) => r.total_ht) },
    { header: "TVA", width: 14, money: true, value: (r) => Number(r.vat_amount), total: sum((r) => r.vat_amount) },
    { header: "Total TTC", width: 15, money: true, value: (r) => Number(r.total_ttc), total: sum((r) => r.total_ttc) },
    ...(isQ ? [] : [{ header: "Reste à payer", width: 15, money: true, value: rest, total: sum(rest) }]),
  ];

  if (format === "pdf") {
    const sub = [`Édité le ${fmtDate(today())}`, status && labels[status] ? `Statut : ${labels[status]}` : "", q ? `Recherche : ${q}` : ""].filter(Boolean).join(" · ");
    const buf = await renderReport(title, sub,
      [[isQ ? "Devis" : "Factures", String(rows.length)], ["Total HT", fmt(sum((r) => r.total_ht))], ["TVA", fmt(sum((r) => r.vat_amount))], ["Total TTC", fmt(sum((r) => r.total_ttc))]],
      columns.map((c) => c.header), columns.map((c) => c.width),
      rows.map((r) => columns.map((c) => (c.money ? fmt(c.value(r) as number, false) : String(c.value(r))))), s);
    return new Response(new Uint8Array(buf), { headers: headers("application/pdf") });
  }

  const wb = new ExcelJS.Workbook(); wb.creator = s.company_name;
  const ws = wb.addWorksheet(isQ ? "Devis" : "Factures");
  ws.columns = columns.map((c, i) => ({ header: c.header, key: String(i), width: c.width, style: c.money ? { numFmt: "#,##0.000" } : {} }));
  rows.forEach((r) => ws.addRow(columns.map((c) => c.value(r))));
  if (rows.length) ws.addRow(columns.map((c, i) => (i === 0 ? "TOTAL" : c.total ?? ""))).font = { bold: true };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2A66" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new Response(new Uint8Array(buf), { headers: headers("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") });
}
