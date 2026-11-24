import { z } from "zod";
import { getDb, type Q } from "./db";
import { AppError } from "./api";
import { can, type SessionUser } from "./auth";
import { computeTotals, fromM, toM, lineTotal } from "./money";
import { audit, nextNumber, refreshStatuses, today } from "./util";
import { getSettings } from "./settings";

export type Kind = "quote" | "invoice";
const T = { quote: { table: "quotes", items: "quote_items", fk: "quote_id", prefix: "DEV" as const }, invoice: { table: "invoices", items: "invoice_items", fk: "invoice_id", prefix: "FAC" as const } };

const money = z.coerce.number().finite().min(0, "doit être positif");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date invalide");

export const itemSchema = z.object({
  service_id: z.coerce.number().int().positive().nullable().optional(),
  description: z.string().trim().min(1, "description requise").max(500),
  quantity: z.coerce.number().finite().positive("quantité > 0").max(100000),
  unit_price: money.max(100_000_000),
});
const base = {
  customer_id: z.coerce.number().int().positive("client requis"),
  issue_date: date,
  notes: z.string().max(2000).default(""),
  conditions: z.string().max(4000).default(""),
  discount: money.default(0),
  extra_charges: money.default(0),
  items: z.array(itemSchema).min(1, "Ajoutez au moins un service").max(50),
};
export const quoteSchema = z.object({ ...base, valid_until: date, status: z.enum(["draft", "sent"]).default("draft") });
export const invoiceSchema = z.object({ ...base, due_date: date, payment_method: z.enum(["bank_transfer", "cash", "check", "other"]).default("bank_transfer"), status: z.enum(["draft", "issued"]).default("issued") });

type Input = z.infer<typeof quoteSchema> | z.infer<typeof invoiceSchema>;

function guardDiscount(user: SessionUser, input: { discount: number; extra_charges: number }, before?: { discount: number; extra_charges: number }) {
  if (can(user.role, "discount")) return;
  if (toM(input.discount) !== toM(before?.discount ?? 0) || toM(input.extra_charges) !== toM(before?.extra_charges ?? 0))
    throw new AppError("Vous n'êtes pas autorisé à appliquer des remises ou des frais additionnels.", 403);
}

async function writeItems(q: Q, kind: Kind, id: number, items: Input["items"]) {
  const t = T[kind];
  await q.query(`DELETE FROM ${t.items} WHERE ${t.fk}=$1`, [id]);
  let i = 0;
  for (const it of items) {
    await q.query(`INSERT INTO ${t.items}(${t.fk},position,service_id,description,quantity,unit_price,line_total) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [id, i++, it.service_id ?? null, it.description, it.quantity, it.unit_price, lineTotal(it)]);
  }
}

export async function createDoc(kind: Kind, user: SessionUser, raw: unknown) {
  const input = (kind === "quote" ? quoteSchema : invoiceSchema).parse(raw) as any;
  guardDiscount(user, input);
  const s = await getSettings();
  const totals = computeTotals(input.items, input.discount, input.extra_charges, s.vat_rate);
  const t = T[kind];
  const db = await getDb();
  return db.tx(async (q) => {
    const c = await q.query("SELECT id FROM customers WHERE id=$1", [input.customer_id]);
    if (!c.rows.length) throw new AppError("Client introuvable.", 404);
    const year = Number(input.issue_date.slice(0, 4));
    const number = await nextNumber(q, t.prefix, year);
    const cols = kind === "quote"
      ? { valid_until: input.valid_until } : { due_date: input.due_date, payment_method: input.payment_method };
    const extraCols = Object.keys(cols);
    const { rows } = await q.query<{ id: number }>(
      `INSERT INTO ${t.table}(number,customer_id,status,issue_date,notes,conditions,subtotal_ht,discount,extra_charges,total_ht,vat_rate,vat_amount,total_ttc,created_by,${extraCols.join(",")})
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,${extraCols.map((_, i) => `$${15 + i}`).join(",")}) RETURNING id`,
      [number, input.customer_id, input.status, input.issue_date, input.notes, input.conditions, totals.subtotal_ht, totals.discount, totals.extra_charges, totals.total_ht, totals.vat_rate, totals.vat_amount, totals.total_ttc, user.id, ...Object.values(cols)]);
    await writeItems(q, kind, rows[0].id, input.items);
    await audit(q, user, "create", kind, rows[0].id, { number, total_ttc: totals.total_ttc, status: input.status });
    return { id: rows[0].id, number };
  });
}

export async function updateDoc(kind: Kind, user: SessionUser, id: number, raw: unknown) {
  const input = (kind === "quote" ? quoteSchema : invoiceSchema).parse(raw) as any;
  const s = await getSettings();
  const t = T[kind];
  const db = await getDb();
  return db.tx(async (q) => {
    const cur = (await q.query<any>(`SELECT * FROM ${t.table} WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    if (!cur) throw new AppError("Document introuvable.", 404);
    if (cur.status !== "draft") throw new AppError("Seuls les brouillons sont modifiables.", 409);
    guardDiscount(user, input, cur);
    const totals = computeTotals(input.items, input.discount, input.extra_charges, s.vat_rate);
    const common = [input.customer_id, input.status, input.issue_date, input.notes, input.conditions, totals.subtotal_ht, totals.discount, totals.extra_charges, totals.total_ht, totals.vat_rate, totals.vat_amount, totals.total_ttc];
    if (kind === "quote")
      await q.query(`UPDATE quotes SET customer_id=$1,status=$2,issue_date=$3,notes=$4,conditions=$5,subtotal_ht=$6,discount=$7,extra_charges=$8,total_ht=$9,vat_rate=$10,vat_amount=$11,total_ttc=$12,valid_until=$13,updated_at=now() WHERE id=$14`, [...common, input.valid_until, id]);
    else
      await q.query(`UPDATE invoices SET customer_id=$1,status=$2,issue_date=$3,notes=$4,conditions=$5,subtotal_ht=$6,discount=$7,extra_charges=$8,total_ht=$9,vat_rate=$10,vat_amount=$11,total_ttc=$12,due_date=$13,payment_method=$14,updated_at=now() WHERE id=$15`, [...common, input.due_date, input.payment_method, id]);
    await writeItems(q, kind, id, input.items);
    await audit(q, user, "update", kind, id, { number: cur.number, before: { total_ttc: cur.total_ttc }, after: { total_ttc: totals.total_ttc, status: input.status } });
    return { id, number: cur.number };
  });
}

const QUOTE_FLOW: Record<string, string[]> = {
  draft: ["sent", "accepted", "rejected"], sent: ["accepted", "rejected", "draft"], rejected: ["draft"], expired: ["draft"], accepted: [], converted: [],
};

export async function setQuoteStatus(user: SessionUser, id: number, to: string) {
  const s = await getSettings();
  const db = await getDb();
  return db.tx(async (q) => {
    await refreshStatuses(q);
    const cur = (await q.query<any>("SELECT * FROM quotes WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!cur) throw new AppError("Devis introuvable.", 404);
    if (!QUOTE_FLOW[cur.status]?.includes(to)) throw new AppError(`Transition impossible : ${cur.status} → ${to}.`, 409);
    if ((to === "accepted" || to === "sent") && cur.valid_until < today()) throw new AppError("Ce devis a dépassé sa date de validité.", 409);
    // Reopening a rejected/expired quote renews its validity period.
    const renew = to === "draft" && cur.valid_until < today();
    await q.query("UPDATE quotes SET status=$1, valid_until = CASE WHEN $3 THEN ($4::date + $5::int) ELSE valid_until END, updated_at=now() WHERE id=$2", [to, id, renew, today(), s.quote_validity_days]);
    await audit(q, user, "status", "quote", id, { number: cur.number, from: cur.status, to });
    return { ok: true };
  });
}

/** Workflow 2: accepted quote -> invoice, preserving customer, lines, prices and tax; linked through quote_id. */
export async function convertQuote(user: SessionUser, id: number) {
  const s = await getSettings();
  const db = await getDb();
  return db.tx(async (q) => {
    const quote = (await q.query<any>("SELECT * FROM quotes WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!quote) throw new AppError("Devis introuvable.", 404);
    if (quote.status !== "accepted") throw new AppError("Seuls les devis acceptés peuvent être convertis en facture.", 409);
    const items = (await q.query<any>("SELECT * FROM quote_items WHERE quote_id=$1 ORDER BY position", [id])).rows;
    const issue = today();
    const number = await nextNumber(q, "FAC", Number(issue.slice(0, 4)));
    const due = new Date(issue + "T12:00:00Z"); due.setUTCDate(due.getUTCDate() + s.invoice_due_days);
    const inv = (await q.query<{ id: number }>(
      `INSERT INTO invoices(number,customer_id,quote_id,status,issue_date,due_date,notes,conditions,subtotal_ht,discount,extra_charges,total_ht,vat_rate,vat_amount,total_ttc,created_by)
       VALUES($1,$2,$3,'issued',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [number, quote.customer_id, id, issue, due.toISOString().slice(0, 10), quote.notes, s.invoice_conditions, quote.subtotal_ht, quote.discount, quote.extra_charges, quote.total_ht, quote.vat_rate, quote.vat_amount, quote.total_ttc, user.id])).rows[0];
    for (const it of items)
      await q.query("INSERT INTO invoice_items(invoice_id,position,service_id,description,quantity,unit_price,line_total) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [inv.id, it.position, it.service_id, it.description, it.quantity, it.unit_price, it.line_total]);
    await q.query("UPDATE quotes SET status='converted', updated_at=now() WHERE id=$1", [id]);
    await audit(q, user, "convert", "quote", id, { quote: quote.number, invoice: number, total_ttc: quote.total_ttc });
    await audit(q, user, "create", "invoice", inv.id, { number, from_quote: quote.number, total_ttc: quote.total_ttc, status: "issued" });
    return { id: inv.id, number };
  });
}

export async function setInvoiceStatus(user: SessionUser, id: number, to: "issued" | "cancelled") {
  const db = await getDb();
  return db.tx(async (q) => {
    const cur = (await q.query<any>("SELECT * FROM invoices WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!cur) throw new AppError("Facture introuvable.", 404);
    if (to === "issued") {
      if (cur.status !== "draft") throw new AppError("Seule une facture brouillon peut être émise.", 409);
    } else {
      if (cur.status === "cancelled") throw new AppError("Facture déjà annulée.", 409);
      if (cur.amount_paid > 0) throw new AppError("Impossible d'annuler une facture ayant des paiements enregistrés.", 409);
    }
    await q.query("UPDATE invoices SET status=$1, updated_at=now() WHERE id=$2", [to, id]);
    if (to === "cancelled" && cur.quote_id)
      await q.query("UPDATE quotes SET status='accepted', updated_at=now() WHERE id=$1 AND status='converted'", [cur.quote_id]);
    await audit(q, user, "status", "invoice", id, { number: cur.number, from: cur.status, to });
    if (to === "issued") await refreshStatuses(q);
    return { ok: true };
  });
}

export const paymentSchema = z.object({
  amount: z.coerce.number().finite().positive("montant > 0"),
  method: z.enum(["bank_transfer", "cash", "check", "other"]),
  paid_on: date,
  reference: z.string().trim().max(200).default(""),
  notes: z.string().max(1000).default(""),
});

/** Workflow 3: records a payment, recomputes balance and status atomically (row lock on the invoice). */
export async function addPayment(user: SessionUser, invoiceId: number, raw: unknown) {
  const p = paymentSchema.parse(raw);
  const db = await getDb();
  return db.tx(async (q) => {
    const inv = (await q.query<any>("SELECT * FROM invoices WHERE id=$1 FOR UPDATE", [invoiceId])).rows[0];
    if (!inv) throw new AppError("Facture introuvable.", 404);
    if (["draft", "cancelled"].includes(inv.status)) throw new AppError("Cette facture n'accepte pas de paiement (brouillon ou annulée).", 409);
    const remaining = toM(inv.total_ttc) - toM(inv.amount_paid);
    const amt = toM(p.amount);
    if (amt > remaining) throw new AppError(`Le montant dépasse le solde restant (${fromM(remaining).toFixed(3)} TND).`, 400);
    if (p.paid_on > today()) throw new AppError("La date de paiement ne peut pas être dans le futur.", 400);
    const year = Number(p.paid_on.slice(0, 4));
    const receipt = await nextNumber(q, "REC", year);
    const pay = (await q.query<{ id: number }>(
      "INSERT INTO payments(receipt_number,invoice_id,customer_id,amount,method,paid_on,reference,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
      [receipt, invoiceId, inv.customer_id, fromM(amt), p.method, p.paid_on, p.reference, p.notes, user.id])).rows[0];
    const paid = toM(inv.amount_paid) + amt;
    const status = paid >= toM(inv.total_ttc) ? "paid" : inv.due_date < today() ? "overdue" : "partially_paid";
    await q.query("UPDATE invoices SET amount_paid=$1, status=$2, updated_at=now() WHERE id=$3", [fromM(paid), status, invoiceId]);
    await audit(q, user, "payment", "invoice", invoiceId, { invoice: inv.number, receipt, amount: fromM(amt), method: p.method, balance: fromM(toM(inv.total_ttc) - paid), status });
    return { id: pay.id, receipt_number: receipt, status };
  });
}

export async function getDoc(kind: Kind, id: number) {
  const t = T[kind];
  const db = await getDb();
  await refreshStatuses(db);
  const doc = (await db.query<any>(
    `SELECT d.*, c.code AS customer_code, c.full_name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
            c.address AS customer_address, c.cin_passport AS customer_cin, c.student_name AS customer_student
     FROM ${t.table} d JOIN customers c ON c.id=d.customer_id WHERE d.id=$1`, [id])).rows[0];
  if (!doc) return null;
  doc.items = (await db.query(`SELECT * FROM ${t.items} WHERE ${t.fk}=$1 ORDER BY position`, [id])).rows;
  if (kind === "invoice") {
    doc.payments = (await db.query("SELECT * FROM payments WHERE invoice_id=$1 ORDER BY paid_on, id", [id])).rows;
    if (doc.quote_id) doc.quote_number = (await db.query("SELECT number FROM quotes WHERE id=$1", [doc.quote_id])).rows[0]?.number;
  } else {
    doc.invoice = (await db.query("SELECT id,number FROM invoices WHERE quote_id=$1 AND status<>'cancelled'", [id])).rows[0] ?? null;
  }
  return doc;
}

export async function getPayment(id: number) {
  const db = await getDb();
  const p = (await db.query<any>(
    `SELECT p.*, i.number AS invoice_number, i.total_ttc, i.amount_paid AS invoice_paid, c.code AS customer_code, c.full_name AS customer_name,
            c.address AS customer_address, c.phone AS customer_phone, c.email AS customer_email, c.student_name AS customer_student
     FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN customers c ON c.id=p.customer_id WHERE p.id=$1`, [id])).rows[0];
  if (!p) return null;
  // Balance as of this receipt (payments up to and including this one).
  const r = (await db.query<{ s: number }>("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE invoice_id=$1 AND id <= $2", [p.invoice_id, p.id])).rows[0];
  p.paid_to_date = r.s;
  return p;
}
