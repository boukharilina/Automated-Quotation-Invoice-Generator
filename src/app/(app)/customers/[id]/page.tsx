import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePage, can } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fmt } from "@/lib/money";
import { fmtDate, METHODS, refreshStatuses } from "@/lib/util";
import CustomerForm from "@/components/CustomerForm";
import { A, Badge, PageHeader, Right, Table } from "@/components/ui";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("customers");
  const id = Number((await params).id);
  const db = await getDb(); await refreshStatuses(db);
  const c = (await db.query<any>("SELECT * FROM customers WHERE id=$1", [id])).rows[0];
  if (!c) notFound();
  const showInv = can(user.role, "invoices");
  const quotes = (await db.query<any>("SELECT id,number,status,issue_date,total_ttc FROM quotes WHERE customer_id=$1 ORDER BY id DESC", [id])).rows;
  const invoices = showInv ? (await db.query<any>("SELECT id,number,status,issue_date,total_ttc,amount_paid FROM invoices WHERE customer_id=$1 ORDER BY id DESC", [id])).rows : [];
  const pays = showInv ? (await db.query<any>("SELECT p.*, i.number AS invoice_number FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE p.customer_id=$1 ORDER BY p.id DESC", [id])).rows : [];
  const billed = invoices.filter((i) => !["draft", "cancelled"].includes(i.status));
  const due = billed.reduce((s, i) => s + (i.total_ttc - i.amount_paid), 0);
  return (
    <>
      <PageHeader title={c.full_name} subtitle={`${c.code} · inscrit le ${fmtDate(c.registered_at)}`}>
        <Link href={`/quotes/new?customer=${id}`} className="btn-accent">Nouveau devis</Link>
        {showInv && <Link href={`/invoices/new?customer=${id}`} className="btn-ghost">Nouvelle facture</Link>}
      </PageHeader>
      <CustomerForm init={c} id={id} />
      {showInv && <p className="mt-4 text-sm text-slate-600">Solde dû : <b className={due > 0 ? "text-accent" : "text-emerald-700"}>{fmt(due)}</b></p>}
      <h2 className="mb-2 mt-8 text-lg font-semibold text-brand">Devis</h2>
      <Table head={["N°", "Date", "Statut", { t: "Total TTC", right: true }]} empty="Aucun devis.">
        {quotes.map((q) => <tr key={q.id}><td className="td"><A href={`/quotes/${q.id}`}>{q.number}</A></td><td className="td">{fmtDate(q.issue_date)}</td><td className="td"><Badge kind="quote" status={q.status} /></td><Right>{fmt(q.total_ttc)}</Right></tr>)}
      </Table>
      {showInv && <>
        <h2 className="mb-2 mt-8 text-lg font-semibold text-brand">Factures</h2>
        <Table head={["N°", "Date", "Statut", { t: "Total TTC", right: true }, { t: "Payé", right: true }]} empty="Aucune facture.">
          {invoices.map((i) => <tr key={i.id}><td className="td"><A href={`/invoices/${i.id}`}>{i.number}</A></td><td className="td">{fmtDate(i.issue_date)}</td><td className="td"><Badge kind="invoice" status={i.status} /></td><Right>{fmt(i.total_ttc)}</Right><Right>{fmt(i.amount_paid)}</Right></tr>)}
        </Table>
        <h2 className="mb-2 mt-8 text-lg font-semibold text-brand">Paiements</h2>
        <Table head={["Reçu", "Date", "Facture", "Mode", { t: "Montant", right: true }]} empty="Aucun paiement.">
          {pays.map((p) => <tr key={p.id}><td className="td"><a className="font-medium text-brand hover:underline" target="_blank" href={`/api/payments/${p.id}/pdf`}>{p.receipt_number}</a></td><td className="td">{fmtDate(p.paid_on)}</td><td className="td"><A href={`/invoices/${p.invoice_id}`}>{p.invoice_number}</A></td><td className="td">{METHODS[p.method]}</td><Right>{fmt(p.amount)}</Right></tr>)}
        </Table>
      </>}
    </>
  );
}
