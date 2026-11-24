import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { fmt } from "@/lib/money";
import { fmtDate, INVOICE_STATUS } from "@/lib/util";
import { filteredInvoices } from "@/lib/reports";
import { A, Badge, PageHeader, Right, Table } from "@/components/ui";

export default async function Invoices({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requirePage("invoices");
  const { q = "", status = "" } = await searchParams;
  let rows = await filteredInvoices({ status: status || undefined });
  if (q) rows = rows.filter((r) => (r.number + r.customer_name).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Factures" subtitle={`${rows.length} résultat(s)`}>
        <Link href="/invoices/new" className="btn-accent"><Plus size={16} /> Nouvelle facture</Link>
      </PageHeader>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="N° ou client…" className="input !w-64" />
        <select name="status" defaultValue={status} className="input !w-auto"><option value="">Tous les statuts</option>{Object.entries(INVOICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn-ghost">Filtrer</button>
      </form>
      <Table head={["N°", "Client", "Date", "Échéance", "Statut", { t: "Total TTC", right: true }, { t: "Reste", right: true }]} empty="Aucune facture.">
        {rows.slice(0, 300).map((r) => (
          <tr key={r.id} className="hover:bg-slate-50">
            <td className="td"><A href={`/invoices/${r.id}`}>{r.number}</A></td><td className="td">{r.customer_name}</td>
            <td className="td">{fmtDate(r.issue_date)}</td><td className="td">{fmtDate(r.due_date)}</td>
            <td className="td"><Badge kind="invoice" status={r.status} /></td><Right>{fmt(r.total_ttc)}</Right>
            <Right>{r.status === "cancelled" ? "—" : fmt(r.total_ttc - r.amount_paid)}</Right>
          </tr>
        ))}
      </Table>
    </>
  );
}
