import ExcelJS from "exceljs";
import { getDb } from "./db";
import { AppError } from "./api";
import { fromM, toM } from "./money";
import { audit } from "./util";

/** TVA à payer si la TVA collectée dépasse la TVA déductible, sinon crédit de TVA. */
export function vatBalance(collected: number, deductible: number) {
  const net = toM(collected) - toM(deductible);
  return { payable: fromM(Math.max(net, 0)), credit: fromM(Math.max(-net, 0)) };
}

export interface Purchase { invoice_date: string; supplier: string; reference: string; amount_ht: number; vat_amount: number }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Valeur brute d'une cellule : formules et texte enrichi ramenés à leur résultat. */
function raw(v: any): any {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if (v.richText) return v.richText.map((t: any) => t.text).join("");
    if ("result" in v) return raw(v.result);
    if ("text" in v) return raw(v.text);
    return "";
  }
  return v ?? "";
}

function parseDate(v: any): string | null {
  let d: Date;
  if (v instanceof Date) d = v;
  else if (typeof v === "number" && v > 20000 && v < 80000) d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86_400_000);
  else {
    const s = String(v).trim();
    const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (!fr && !iso) return null;
    const [y, m, day] = fr ? [+fr[3], +fr[2], +fr[1]] : [+iso![1], +iso![2], +iso![3]];
    d = new Date(Date.UTC(y, m - 1, day));
    if (d.getUTCMonth() !== m - 1 || d.getUTCDate() !== day) return null;
  }
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Accepte 570, "570,000", "1 234,500 TND" ou "1.234,500". Cellule vide : 0. */
function parseAmount(v: any): number | null {
  if (typeof v === "number") return fromM(toM(v));
  let s = String(v).replace(/\s|TND|DT/gi, "");
  if (!s) return 0;
  const comma = s.lastIndexOf(","), dot = s.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) s = comma > dot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else s = s.replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(s) ? fromM(toM(s)) : null;
}

type Columns = Partial<Record<"date" | "supplier" | "reference" | "ht" | "vat", number>>;

/** Reconnaît la ligne d'en-têtes ; « Date » et une colonne TVA sont obligatoires. */
function findColumns(row: ExcelJS.Row): Columns | null {
  const col: Columns = {};
  row.eachCell((cell, n) => {
    const words = norm(String(raw(cell.value))).split(" ");
    const has = (...w: string[]) => w.some((x) => words.includes(x));
    if (words[0] === "date") col.date ??= n;
    else if (has("fournisseur", "supplier")) col.supplier ??= n;
    else if (has("tva") && !has("taux", "matricule", "code", "ht", "ttc", "collectee")) col.vat ??= n;
    else if (has("ht")) col.ht ??= n;
    else if (has("facture", "reference", "ref", "piece")) col.reference ??= n;
  });
  return col.date && col.vat ? col : null;
}

/** Lit un classeur d'achats. Toute ligne invalide fait rejeter le fichier entier : rien n'est importé à moitié. */
export async function parseDeductible(data: ArrayBuffer): Promise<Purchase[]> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(data); } catch { throw new AppError("Fichier illisible : envoyez un classeur Excel .xlsx."); }

  for (const ws of wb.worksheets) {
    for (let h = 1; h <= Math.min(20, ws.rowCount); h++) {
      const col = findColumns(ws.getRow(h));
      if (!col) continue;
      const rows: Purchase[] = []; const errors: string[] = [];
      for (let r = h + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const get = (n?: number) => (n ? raw(row.getCell(n).value) : "");
        if (Object.values(col).every((n) => String(get(n)).trim() === "")) continue;
        const date = parseDate(get(col.date));
        // Ligne de total en bas de tableau : pas de date, un libellé « Total ».
        if (!date && (row.values as any[]).some((c) => norm(String(raw(c))).startsWith("total"))) continue;
        const vat = String(get(col.vat)).trim() === "" ? null : parseAmount(get(col.vat));
        const ht = parseAmount(get(col.ht));
        if (!date) errors.push(`ligne ${r} : date absente ou invalide`);
        else if (vat === null) errors.push(`ligne ${r} : TVA absente ou invalide`);
        else if (ht === null) errors.push(`ligne ${r} : montant HT invalide`);
        else rows.push({ invoice_date: date, supplier: String(get(col.supplier)).trim().slice(0, 200), reference: String(get(col.reference)).trim().slice(0, 100), amount_ht: ht, vat_amount: vat });
      }
      if (errors.length) throw new AppError(`Import annulé – ${errors.slice(0, 5).join(" ; ")}${errors.length > 5 ? ` (et ${errors.length - 5} autres)` : ""}.`);
      if (!rows.length) throw new AppError("Aucune ligne d'achat trouvée dans le fichier.");
      if (rows.length > 5000) throw new AppError("Fichier trop long : 5 000 lignes au maximum.");
      return rows;
    }
  }
  throw new AppError("Colonnes introuvables : le fichier doit contenir au moins « Date » et « TVA déductible ».");
}

export async function listDeductible() {
  const db = await getDb();
  return (await db.query<Purchase & { id: number }>("SELECT id, invoice_date, supplier, reference, amount_ht, vat_amount FROM vat_deductible ORDER BY invoice_date, id")).rows;
}

type User = { id: number; name: string };
const IN_MONTH = "to_char(invoice_date,'YYYY-MM') = $1";

/** Remplace les mois présents dans le fichier, pour qu'un fichier corrigé puisse être réimporté sans doublons. */
export async function importDeductible(user: User, rows: Purchase[]) {
  const db = await getDb();
  const months = [...new Set(rows.map((r) => r.invoice_date.slice(0, 7)))].sort();
  await db.tx(async (q) => {
    for (const m of months) await q.query(`DELETE FROM vat_deductible WHERE ${IN_MONTH}`, [m]);
    for (const r of rows) {
      await q.query("INSERT INTO vat_deductible(invoice_date,supplier,reference,amount_ht,vat_amount,created_by) VALUES($1,$2,$3,$4,$5,$6)",
        [r.invoice_date, r.supplier, r.reference, r.amount_ht, r.vat_amount, user.id]);
    }
    await audit(q, user, "import", "vat_deductible", months.join(","), { lines: rows.length });
  });
  return { count: rows.length, months };
}

export async function deleteDeductibleMonth(user: User, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new AppError("Période invalide.");
  const db = await getDb();
  await db.tx(async (q) => {
    await q.query(`DELETE FROM vat_deductible WHERE ${IN_MONTH}`, [month]);
    await audit(q, user, "delete", "vat_deductible", month);
  });
}
