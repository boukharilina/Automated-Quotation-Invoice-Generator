import ExcelJS from "exceljs";
import { route, AppError } from "@/lib/api";
import { vatDeclaration } from "@/lib/reports";
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

  const [all, s] = await Promise.all([vatDeclaration(), getSettings()]);
  const list = all.filter((i) => String(i.issue_date).startsWith(month ?? year));
  const sum = (rows: any[], key: string) => fromM(rows.reduce((a, i) => a + toM(i[key]), 0));

  const wb = new ExcelJS.Workbook(); wb.creator = s.company_name;
  const style = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2A66" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    ws.headerFooter.oddHeader = `&L${s.company_name.replace(/&/g, "&&")} – ${s.tax_id.replace(/&/g, "&&")}&RDéclaration TVA collectée ${month ?? year}`;
  };

  const w1 = wb.addWorksheet("Déclaration TVA");
  w1.columns = [
    { header: "Mois", key: "m", width: 20 }, { header: "Factures", key: "n", width: 10 },
    { header: "Total HT", key: "ht", width: 16, style: NUM }, { header: "TVA collectée", key: "vat", width: 16, style: NUM },
    { header: "Timbre fiscal", key: "stamp", width: 16, style: NUM }, { header: "Total TTC", key: "ttc", width: 16, style: NUM },
  ];
  const keys = month ? [month] : MONTHS.map((_, k) => `${year}-${String(k + 1).padStart(2, "0")}`);
  for (const key of keys) {
    const rows = list.filter((i) => String(i.issue_date).startsWith(key));
    w1.addRow({ m: `${MONTHS[Number(key.slice(5)) - 1]} ${year}`, n: rows.length, ht: sum(rows, "total_ht"), vat: sum(rows, "vat_amount"), stamp: sum(rows, "stamp_duty"), ttc: sum(rows, "total_ttc") });
  }
  const n = keys.length + 1;
  const f = (col: string, key: string) => ({ formula: `SUM(${col}2:${col}${n})`, result: sum(list, key) });
  w1.addRow({ m: "TOTAL", n: { formula: `SUM(B2:B${n})`, result: list.length }, ht: f("C", "total_ht"), vat: f("D", "vat_amount"), stamp: f("E", "stamp_duty"), ttc: f("F", "total_ttc") }).font = { bold: true };
  style(w1);

  const w2 = wb.addWorksheet("Factures");
  w2.columns = [
    { header: "N° facture", key: "number", width: 18 }, { header: "Date", key: "date", width: 12 }, { header: "Client", key: "c", width: 30 }, { header: "CIN / Passeport", key: "cin", width: 18 },
    { header: "Total HT", key: "ht", width: 16, style: NUM }, { header: "Taux TVA (%)", key: "rate", width: 14 }, { header: "TVA", key: "vat", width: 16, style: NUM },
    { header: "Timbre fiscal", key: "stamp", width: 16, style: NUM }, { header: "Total TTC", key: "ttc", width: 16, style: NUM },
  ];
  list.forEach((i) => w2.addRow({ number: i.number, date: fmtDate(i.issue_date), c: i.customer_name, cin: i.cin_passport, ht: i.total_ht, rate: Number(i.vat_rate), vat: i.vat_amount, stamp: i.stamp_duty, ttc: i.total_ttc }));
  style(w2);

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="declaration-tva-${month ?? year}.xlsx"` } });
});
