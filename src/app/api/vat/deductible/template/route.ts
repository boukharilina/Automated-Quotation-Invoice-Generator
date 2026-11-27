import ExcelJS from "exceljs";
import { route } from "@/lib/api";

/** Modèle vierge à remplir pour la TVA déductible. */
export const GET = route("vat", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Achats");
  ws.columns = [
    { header: "Date", key: "d", width: 14, style: { numFmt: "dd/mm/yyyy" } }, { header: "Fournisseur", key: "s", width: 32 },
    { header: "N° facture", key: "r", width: 18 }, { header: "Montant HT", key: "ht", width: 16, style: { numFmt: "#,##0.000" } },
    { header: "TVA déductible", key: "vat", width: 18, style: { numFmt: "#,##0.000" } },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2A66" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="modele-tva-deductible.xlsx"' } });
});
