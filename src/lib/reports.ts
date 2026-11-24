import { getDb } from "./db";
import { refreshStatuses } from "./util";

export interface Filters { from?: string; to?: string; customer?: number; service?: number; status?: string; pay?: string }

export function parseFilters(sp: URLSearchParams | Record<string, string | string[] | undefined>): Filters {
  const get = (k: string) => { const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k]; return (Array.isArray(v) ? v[0] : v) || undefined; };
  const f: Filters = {};
  const d = /^\d{4}-\d{2}-\d{2}$/;
  if (get("from") && d.test(get("from")!)) f.from = get("from");
  if (get("to") && d.test(get("to")!)) f.to = get("to");
  if (Number(get("customer"))) f.customer = Number(get("customer"));
  if (Number(get("service"))) f.service = Number(get("service"));
  if (["draft", "issued", "partially_paid", "paid", "overdue", "cancelled"].includes(get("status") || "")) f.status = get("status");
  if (["unpaid", "partial", "paid"].includes(get("pay") || "")) f.pay = get("pay");
  return f;
}

function invoiceWhere(f: Filters, alias = "i") {
  const w: string[] = []; const p: any[] = [];
  const add = (sql: string, v: any) => { p.push(v); w.push(sql.replace("?", `$${p.length}`)); };
  if (f.from) add(`${alias}.issue_date >= ?`, f.from);
  if (f.to) add(`${alias}.issue_date <= ?`, f.to);
  if (f.customer) add(`${alias}.customer_id = ?`, f.customer);
  if (f.service) add(`EXISTS (SELECT 1 FROM invoice_items it WHERE it.invoice_id=${alias}.id AND it.service_id = ?)`, f.service);
  if (f.status) add(`${alias}.status = ?`, f.status);
  if (f.pay === "unpaid") w.push(`${alias}.amount_paid = 0 AND ${alias}.status NOT IN ('draft','cancelled')`);
  if (f.pay === "partial") w.push(`${alias}.amount_paid > 0 AND ${alias}.amount_paid < ${alias}.total_ttc`);
  if (f.pay === "paid") w.push(`${alias}.amount_paid >= ${alias}.total_ttc AND ${alias}.status <> 'cancelled'`);
  return { where: w.length ? "WHERE " + w.join(" AND ") : "", params: p };
}

export async function filteredInvoices(f: Filters) {
  const db = await getDb(); await refreshStatuses(db);
  const { where, params } = invoiceWhere(f);
  return (await db.query<any>(
    `SELECT i.*, c.full_name AS customer_name, c.code AS customer_code,
            (SELECT string_agg(description, ' + ' ORDER BY position) FROM invoice_items WHERE invoice_id=i.id) AS services
     FROM invoices i JOIN customers c ON c.id=i.customer_id ${where} ORDER BY i.issue_date DESC, i.id DESC`, params)).rows;
}

export async function filteredPayments(f: Filters) {
  const db = await getDb();
  const { where, params } = invoiceWhere(f);
  return (await db.query<any>(
    `SELECT p.*, i.number AS invoice_number, c.full_name AS customer_name FROM payments p
     JOIN invoices i ON i.id=p.invoice_id JOIN customers c ON c.id=p.customer_id
     WHERE p.invoice_id IN (SELECT i.id FROM invoices i ${where}) ORDER BY p.paid_on DESC, p.id DESC`, params)).rows;
}

export async function dashboard(f: Filters) {
  const db = await getDb(); await refreshStatuses(db);
  const { where, params } = invoiceWhere(f);
  const live = "i.status NOT IN ('draft','cancelled')";
  const inv = (await db.query<any>(
    `SELECT count(*) FILTER (WHERE ${live})::int AS issued,
            COALESCE(sum(i.total_ht) FILTER (WHERE ${live}),0) AS ht,
            COALESCE(sum(i.total_ttc) FILTER (WHERE ${live}),0) AS ttc,
            COALESCE(sum(i.amount_paid) FILTER (WHERE ${live}),0) AS paid,
            COALESCE(sum(i.total_ttc - i.amount_paid) FILTER (WHERE ${live}),0) AS outstanding,
            count(*) FILTER (WHERE i.status='overdue')::int AS overdue_count,
            COALESCE(sum(i.total_ttc - i.amount_paid) FILTER (WHERE i.status='overdue'),0) AS overdue_amount
     FROM invoices i ${where}`, params)).rows[0];

  // Quotes honour date / customer / service filters.
  const qw: string[] = []; const qp: any[] = [];
  const qadd = (s: string, v: any) => { qp.push(v); qw.push(s.replace("?", `$${qp.length}`)); };
  if (f.from) qadd("q.issue_date >= ?", f.from);
  if (f.to) qadd("q.issue_date <= ?", f.to);
  if (f.customer) qadd("q.customer_id = ?", f.customer);
  if (f.service) qadd("EXISTS (SELECT 1 FROM quote_items it WHERE it.quote_id=q.id AND it.service_id = ?)", f.service);
  const quotes = (await db.query<any>(`SELECT count(*)::int AS n FROM quotes q ${qw.length ? "WHERE " + qw.join(" AND ") : ""}`, qp)).rows[0];

  // Monthly revenue (last 12 months): invoiced TTC vs. cash received.
  const invM = (await db.query<any>(
    `SELECT to_char(i.issue_date,'YYYY-MM') AS m, sum(i.total_ttc) AS invoiced FROM invoices i
     ${where ? where + " AND " : "WHERE "}${live} GROUP BY 1`, params)).rows;
  const payM = (await db.query<any>(
    `SELECT to_char(p.paid_on,'YYYY-MM') AS m, sum(p.amount) AS received FROM payments p
     WHERE p.invoice_id IN (SELECT i.id FROM invoices i ${where}) GROUP BY 1`, params)).rows;
  const months: { m: string; invoiced: number; received: number }[] = [];
  const now = new Date();
  for (let k = 11; k >= 0; k--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
    const m = d.toISOString().slice(0, 7);
    months.push({ m, invoiced: Number(invM.find((r) => r.m === m)?.invoiced ?? 0), received: Number(payM.find((r) => r.m === m)?.received ?? 0) });
  }
  const recentQuotes = (await db.query<any>(`SELECT q.id,q.number,q.status,q.issue_date,q.total_ttc,c.full_name AS customer_name FROM quotes q JOIN customers c ON c.id=q.customer_id ORDER BY q.id DESC LIMIT 5`)).rows;
  const recentInvoices = (await db.query<any>(`SELECT i.id,i.number,i.status,i.issue_date,i.total_ttc,i.amount_paid,c.full_name AS customer_name FROM invoices i JOIN customers c ON c.id=i.customer_id ORDER BY i.id DESC LIMIT 5`)).rows;
  return { inv, quotes: quotes.n, months, recentQuotes, recentInvoices };
}
