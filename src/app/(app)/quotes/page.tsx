import Link from "next/link";
import { Download, FileSpreadsheet, Plus } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { searchQuotes } from "@/lib/reports";
import { fmt } from "@/lib/money";
import { fmtDate, QUOTE_STATUS } from "@/lib/util";
import { A, Badge, PageHeader, Right, Table } from "@/components/ui";

export default async function Quotes({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requirePage("quotes");
  const { q = "", status = "" } = await searchParams;
  const rows = (await searchQuotes(q, status)).slice(0, 300);
  const qs = new URLSearchParams({ q, status }).toString();
  return (
    <>
      <PageHeader title="Devis" subtitle={`${rows.length} résultat(s)`}>
        <a href={`/api/quotes/export?format=xlsx&${qs}`} className="btn-ghost"><FileSpreadsheet size={16} /> Excel</a>
        <a href={`/api/quotes/export?format=pdf&${qs}`} className="btn-ghost"><Download size={16} /> PDF</a>
        <Link href="/quotes/new" className="btn-accent"><Plus size={16} /> Nouveau devis</Link>
      </PageHeader>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="N° ou client…" className="input !w-64" />
        <select name="status" defaultValue={status} className="input !w-auto"><option value="">Tous les statuts</option>{Object.entries(QUOTE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn-ghost">Filtrer</button>
      </form>
      <Table head={["N°", "Client", "Date", "Validité", "Statut", { t: "Total TTC", right: true }]} empty="Aucun devis. Créez le premier !">
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-slate-50">
            <td className="td"><A href={`/quotes/${r.id}`}>{r.number}</A></td><td className="td">{r.customer_name}</td>
            <td className="td">{fmtDate(r.issue_date)}</td><td className="td">{fmtDate(r.valid_until)}</td>
            <td className="td"><Badge kind="quote" status={r.status} /></td><Right>{fmt(r.total_ttc)}</Right>
          </tr>
        ))}
      </Table>
    </>
  );
}
