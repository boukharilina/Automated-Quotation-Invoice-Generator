import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fmt, fromM, toM } from "@/lib/money";
import { searchPayments, type PaymentSearch } from "@/lib/reports";
import { fmtDate, METHODS, refreshStatuses } from "@/lib/util";
import { A, PageHeader, Right, Table } from "@/components/ui";

export default async function Payments({ searchParams }: { searchParams: Promise<PaymentSearch> }) {
  await requirePage("payments");
  const { q = "", method = "", from = "", to = "" } = await searchParams;
  const filtered = Boolean(q || method || from || to);
  const db = await getDb(); await refreshStatuses(db);
  const found = await searchPayments({ q, method, from, to });
  const total = fromM(found.reduce((s, p) => s + toM(p.amount), 0));
  const pays = found.slice(0, 300);
  const open = (await db.query<any>(`SELECT i.id,i.number,i.status,i.due_date,i.total_ttc,i.amount_paid,c.full_name FROM invoices i JOIN customers c ON c.id=i.customer_id
    WHERE i.status IN ('issued','partially_paid','overdue') ORDER BY i.due_date`)).rows;
  return (
    <>
      <PageHeader title="Paiements" subtitle="L'enregistrement d'un paiement se fait depuis la facture concernée." />
      <h2 className="mb-2 text-lg font-semibold text-brand">Factures à encaisser ({open.length})</h2>
      <Table head={["Facture", "Client", "Échéance", { t: "Total TTC", right: true }, { t: "Reste à payer", right: true }]} empty="Aucune facture en attente de paiement.">
        {open.map((i) => (
          <tr key={i.id}><td className="td"><A href={`/invoices/${i.id}`}>{i.number}</A></td><td className="td">{i.full_name}</td>
            <td className={`td ${i.status === "overdue" ? "font-semibold text-red-700" : ""}`}>{fmtDate(i.due_date)}{i.status === "overdue" && " (en retard)"}</td>
            <Right>{fmt(i.total_ttc)}</Right><Right><b>{fmt(i.total_ttc - i.amount_paid)}</b></Right></tr>
        ))}
      </Table>
      <h2 id="historique" className="mb-2 mt-8 text-lg font-semibold text-brand">Historique des paiements</h2>
      <form key={`${q}|${method}|${from}|${to}`} action="#historique" className="mb-3 flex flex-wrap items-end gap-2">
        <input name="q" defaultValue={q} placeholder="Reçu, client, facture, référence…" aria-label="Recherche" className="input !w-72" />
        <select name="method" defaultValue={method} className="input !w-auto" aria-label="Mode de paiement">
          <option value="">Tous les modes</option>
          {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm text-slate-600">Du <input type="date" name="from" defaultValue={from} className="input !w-auto" /></label>
        <label className="flex items-center gap-1 text-sm text-slate-600">au <input type="date" name="to" defaultValue={to} className="input !w-auto" /></label>
        <button className="btn-ghost">Filtrer</button>
        {filtered && <Link href="/payments" className="btn-ghost">Réinitialiser</Link>}
      </form>
      <p className="mb-2 text-sm text-slate-600">{found.length} paiement(s) – total : <b>{fmt(total)}</b>{found.length > pays.length && ` (les ${pays.length} plus récents sont affichés)`}</p>
      <Table head={["Reçu", "Date", "Client", "Facture", "Mode", "Référence", { t: "Montant", right: true }, ""]} empty={filtered ? "Aucun paiement ne correspond à ces filtres." : "Aucun paiement."}>
        {pays.map((p) => (
          <tr key={p.id}><td className="td">{p.receipt_number}</td><td className="td">{fmtDate(p.paid_on)}</td><td className="td">{p.full_name}</td>
            <td className="td"><A href={`/invoices/${p.invoice_id}`}>{p.invoice_number}</A></td><td className="td">{METHODS[p.method]}</td><td className="td">{p.reference || "—"}</td>
            <Right>{fmt(p.amount)}</Right><td className="td"><a className="font-medium text-brand hover:underline" target="_blank" href={`/api/payments/${p.id}/pdf`}>Reçu PDF</a></td></tr>
        ))}
      </Table>
    </>
  );
}
