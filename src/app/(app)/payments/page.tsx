import { requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fmt } from "@/lib/money";
import { fmtDate, METHODS, refreshStatuses } from "@/lib/util";
import { A, PageHeader, Right, Table } from "@/components/ui";

export default async function Payments({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requirePage("payments");
  const { view } = await searchParams;
  const db = await getDb(); await refreshStatuses(db);
  const pays = (await db.query<any>(`SELECT p.*, i.number AS invoice_number, c.full_name FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN customers c ON c.id=p.customer_id ORDER BY p.id DESC LIMIT 300`)).rows;
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
      <h2 className="mb-2 mt-8 text-lg font-semibold text-brand">Historique des paiements</h2>
      <Table head={["Reçu", "Date", "Client", "Facture", "Mode", "Référence", { t: "Montant", right: true }, ""]} empty="Aucun paiement.">
        {pays.map((p) => (
          <tr key={p.id}><td className="td">{p.receipt_number}</td><td className="td">{fmtDate(p.paid_on)}</td><td className="td">{p.full_name}</td>
            <td className="td"><A href={`/invoices/${p.invoice_id}`}>{p.invoice_number}</A></td><td className="td">{METHODS[p.method]}</td><td className="td">{p.reference || "—"}</td>
            <Right>{fmt(p.amount)}</Right><td className="td"><a className="font-medium text-brand hover:underline" target="_blank" href={`/api/payments/${p.id}/pdf`}>Reçu PDF</a></td></tr>
        ))}
      </Table>
    </>
  );
}
