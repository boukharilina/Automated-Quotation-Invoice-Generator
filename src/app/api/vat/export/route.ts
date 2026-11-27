import ExcelJS from "exceljs";
import { route, AppError } from "@/lib/api";
import { vatDeclaration } from "@/lib/reports";
import { listDeductible, vatBalance } from "@/lib/vat";
import { fromM, toM } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { fmtDate, today } from "@/lib/util";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const NUM = { numFmt: "#,##0.000" };

/** Déclaration TVA au format Excel : une année entière, ou un seul mois avec ?month=AAAA-MM. */
export const GET = route("vat", async (req) => {
  const sp = new URL(req.url).searchParams;
  const month = sp.get("month");
  const year = month ? month.slice(0, 4) : sp.get("year") || today().slice(0, 4);
  if (!/^\d{4}$/.test(year) || (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) throw new AppError("Période invalide.");

  const [all, purchases, s] = await Promise.all([vatDeclaration(), listDeductible(), getSettings()]);
  const bought = purchases.filter((a) => a.invoice_date.startsWith(month ?? year));
  const list = all.filter((i) => String(i.issue_date).startsWith(month ?? year));
  const sum = (rows: any[], key: string) => fromM(rows.reduce((a, i) => a + toM(i[key]), 0));

  const wb = new ExcelJS.Workbook(); wb.creator = s.company_name;
  const style = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2A66" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    ws.headerFooter.oddHeader = `&L${s.company_name.replace(/&/g, "&&")} – ${s.tax_id.replace(/&/g, "&&")}&RDéclaration de TVA ${month ?? year}`;
  };

  const w1 = wb.addWorksheet("Déclaration TVA");
  w1.columns = [
    { header: "Mois", key: "m", width: 20 }, { header: "Factures", key: "n", width: 10 },
    { header: "Total HT", key: "ht", width: 16, style: NUM }, { header: "TVA collectée", key: "vat", width: 16, style: NUM },
    { header: "TVA déductible", key: "ded", width: 16, style: NUM }, { header: "TVA à payer", key: "pay", width: 16, style: NUM },
    { header: "Crédit de TVA", key: "cred", width: 16, style: NUM },
    { header: "Timbre fiscal", key: "stamp", width: 16, style: NUM }, { header: "Total TTC", key: "ttc", width: 16, style: NUM },
  ];
  const keys = month ? [month] : MONTHS.map((_, k) => `${year}-${String(k + 1).padStart(2, "0")}`);
  /** Solde d'une ligne : formules Excel, pour que le calcul reste vérifiable dans le classeur. */
  const balance = (row: number, collected: number, deductible: number) => {
    const r = vatBalance(collected, deductible);
    return { pay: { formula: `MAX(D${row}-E${row},0)`, result: r.payable }, cred: { formula: `MAX(E${row}-D${row},0)`, result: r.credit } };
  };
  keys.forEach((key, k) => {
    const rows = list.filter((i) => String(i.issue_date).startsWith(key));
    const vat = sum(rows, "vat_amount"), ded = sum(bought.filter((a) => a.invoice_date.startsWith(key)), "vat_amount");
    w1.addRow({ m: `${MONTHS[Number(key.slice(5)) - 1]} ${year}`, n: rows.length, ht: sum(rows, "total_ht"), vat, ded, ...balance(k + 2, vat, ded), stamp: sum(rows, "stamp_duty"), ttc: sum(rows, "total_ttc") });
  });
  const n = keys.length + 1;
  const f = (col: string, result: number) => ({ formula: `SUM(${col}2:${col}${n})`, result });
  const vat = sum(list, "vat_amount"), ded = sum(bought, "vat_amount");
  w1.addRow({ m: "TOTAL", n: f("B", list.length), ht: f("C", sum(list, "total_ht")), vat: f("D", vat), ded: f("E", ded), ...balance(n + 1, vat, ded), stamp: f("H", sum(list, "stamp_duty")), ttc: f("I", sum(list, "total_ttc")) }).font = { bold: true };
  style(w1);

  const w2 = wb.addWorksheet("Factures");
  w2.columns = [
    { header: "N° facture", key: "number", width: 18 }, { header: "Date", key: "date", width: 12 }, { header: "Client", key: "c", width: 30 }, { header: "CIN / Passeport", key: "cin", width: 18 },
    { header: "Total HT", key: "ht", width: 16, style: NUM }, { header: "Taux TVA (%)", key: "rate", width: 14 }, { header: "TVA", key: "vat", width: 16, style: NUM },
    { header: "Timbre fiscal", key: "stamp", width: 16, style: NUM }, { header: "Total TTC", key: "ttc", width: 16, style: NUM },
  ];
  list.forEach((i) => w2.addRow({ number: i.number, date: fmtDate(i.issue_date), c: i.customer_name, cin: i.cin_passport, ht: i.total_ht, rate: Number(i.vat_rate), vat: i.vat_amount, stamp: i.stamp_duty, ttc: i.total_ttc }));
  style(w2);

  const w3 = wb.addWorksheet("TVA déductible");
  w3.columns = [
    { header: "Date", key: "date", width: 12 }, { header: "Fournisseur", key: "s", width: 30 }, { header: "N° facture", key: "r", width: 18 },
    { header: "Montant HT", key: "ht", width: 16, style: NUM }, { header: "TVA déductible", key: "vat", width: 18, style: NUM },
  ];
  bought.forEach((a) => w3.addRow({ date: fmtDate(a.invoice_date), s: a.supplier, r: a.reference, ht: a.amount_ht, vat: a.vat_amount }));
  style(w3);

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="declaration-tva-${month ?? year}.xlsx"` } });
});
