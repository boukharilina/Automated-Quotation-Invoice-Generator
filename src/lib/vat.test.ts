import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseDeductible, vatBalance } from "./vat";

async function xlsx(rows: unknown[][]) {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Achats").addRows(rows);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
const HEAD = ["Date", "Fournisseur", "N° facture", "Montant HT", "TVA déductible"];

describe("vatBalance", () => {
  it("TVA à payer quand la collectée dépasse la déductible", () => expect(vatBalance(558.824, 100)).toEqual({ payable: 458.824, credit: 0 }));
  it("crédit de TVA dans le cas inverse", () => expect(vatBalance(100, 190.5)).toEqual({ payable: 0, credit: 90.5 }));
  it("rien à payer en cas d'égalité", () => expect(vatBalance(0.3, 0.1 + 0.2)).toEqual({ payable: 0, credit: 0 }));
});

describe("parseDeductible", () => {
  it("lit les dates et montants, et ignore la ligne Total", async () => {
    const rows = await parseDeductible(await xlsx([
      ["Achats 2026"], HEAD,
      [new Date(Date.UTC(2026, 9, 3)), "STEG", "F-1", 1000, 190],
      ["15/10/2026", "Papeterie", "F-2", "1 234,500", "234,555"],
      [],
      ["Total", "", "", 2234.5, 424.555],
    ]));
    expect(rows).toEqual([
      { invoice_date: "2026-10-03", supplier: "STEG", reference: "F-1", amount_ht: 1000, vat_amount: 190 },
      { invoice_date: "2026-10-15", supplier: "Papeterie", reference: "F-2", amount_ht: 1234.5, vat_amount: 234.555 },
    ]);
  });
  it("rejette tout le fichier si une ligne est invalide", async () => {
    await expect(parseDeductible(await xlsx([HEAD, ["31/02/2026", "X", "1", 1, 1]]))).rejects.toThrow("ligne 2 : date");
    await expect(parseDeductible(await xlsx([HEAD, ["01/02/2026", "X", "1", 1, ""]]))).rejects.toThrow("ligne 2 : TVA");
  });
  it("exige les colonnes Date et TVA", async () => {
    await expect(parseDeductible(await xlsx([["Fournisseur", "Montant"]]))).rejects.toThrow("Colonnes introuvables");
  });
});
