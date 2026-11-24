import { requirePage, can } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fmt } from "@/lib/money";
import { fmtDate } from "@/lib/util";
import { PageHeader } from "@/components/ui";

/** Workflow 4 – documents organised automatically by year, then by customer. */
export default async function Archive({ searchParams }: { searchParams: Promise<{ year?: string; q?: string }> }) {
  const user = await requirePage("archive");
  const { year, q = "" } = await searchParams;
  const db = await getDb();
  const inv = can(user.role, "invoices"), pay = can(user.role, "payments");
  const docs = (await db.query<any>(
    `SELECT * FROM (
       SELECT 'quote' AS kind, q.id, q.number, q.issue_date AS d, q.total_ttc AS amount, q.status, c.id AS cid, c.code, c.full_name, '/quotes/'||q.id AS href, '/api/quotes/'||q.id||'/pdf' AS pdf FROM quotes q JOIN customers c ON c.id=q.customer_id
       ${inv ? `UNION ALL SELECT 'invoice', i.id, i.number, i.issue_date, i.total_ttc, i.status, c.id, c.code, c.full_name, '/invoices/'||i.id, '/api/invoices/'||i.id||'/pdf' FROM invoices i JOIN customers c ON c.id=i.customer_id` : ""}
       ${pay ? `UNION ALL SELECT 'receipt', p.id, p.receipt_number, p.paid_on, p.amount, 'paid', c.id, c.code, c.full_name, '/invoices/'||p.invoice_id, '/api/payments/'||p.id||'/pdf' FROM payments p JOIN customers c ON c.id=p.customer_id` : ""}
     ) x WHERE ($1='' OR full_name ILIKE $2 OR number ILIKE $2) ORDER BY d DESC, number DESC`, [q, `%${q}%`])).rows;
  const years = [...new Set(docs.map((d) => String(d.d).slice(0, 4)))].sort().reverse();
  const sel = year && years.includes(year) ? year : years[0];
  const byCust = new Map<string, any[]>();
  for (const d of docs.filter((d) => String(d.d).startsWith(sel ?? "")))
    byCust.set(`${d.code} · ${d.full_name}`, [...(byCust.get(`${d.code} · ${d.full_name}`) ?? []), d]);
  const LABEL: any = { quote: "Devis", invoice: "Facture", receipt: "Reçu" };
  return (
    <>
      <PageHeader title="Archives" subtitle="Tous les documents, classés par année puis par client." />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="year" defaultValue={sel} className="input !w-auto">{years.map((y) => <option key={y}>{y}</option>)}</select>
        <input name="q" defaultValue={q} placeholder="Client ou n° de document…" className="input !w-64" /><button className="btn-ghost">Filtrer</button>
      </form>
      {byCust.size === 0 && <p className="card p-6 text-center text-sm text-slate-500">Aucun document.</p>}
      <div className="space-y-3">
        {[...byCust.entries()].map(([name, list]) => (
          <details key={name} className="card" open={byCust.size <= 3}>
            <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-brand">{sel} / {name} <span className="text-sm font-normal text-slate-500">({list.length} document{list.length > 1 ? "s" : ""})</span></summary>
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {list.map((d) => (
                <li key={d.kind + d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
                  <span className="w-16 text-xs font-semibold uppercase text-slate-500">{LABEL[d.kind]}</span>
                  <a href={d.href} className="font-medium text-brand hover:underline">{d.number}</a>
                  <span className="text-slate-500">{fmtDate(d.d)}</span><span className="tabular-nums">{fmt(d.amount)}</span>
                  <a href={d.pdf} target="_blank" className="ml-auto font-medium text-accent hover:underline">PDF</a>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </>
  );
}
