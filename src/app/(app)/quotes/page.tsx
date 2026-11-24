import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fmt } from "@/lib/money";
import { fmtDate, QUOTE_STATUS, refreshStatuses } from "@/lib/util";
import { A, Badge, PageHeader, Right, Table } from "@/components/ui";

export default async function Quotes({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requirePage("quotes");
  const { q = "", status = "" } = await searchParams;
  const db = await getDb(); await refreshStatuses(db);
  const rows = (await db.query<any>(
    `SELECT d.id,d.number,d.status,d.issue_date,d.valid_until,d.total_ttc,c.full_name FROM quotes d JOIN customers c ON c.id=d.customer_id
     WHERE ($1='' OR d.number ILIKE $2 OR c.full_name ILIKE $2) AND ($3='' OR d.status=$3) ORDER BY d.id DESC LIMIT 300`, [q, `%${q}%`, status])).rows;
  return (
    <>
      <PageHeader title="Devis" subtitle={`${rows.length} résultat(s)`}>
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
            <td className="td"><A href={`/quotes/${r.id}`}>{r.number}</A></td><td className="td">{r.full_name}</td>
            <td className="td">{fmtDate(r.issue_date)}</td><td className="td">{fmtDate(r.valid_until)}</td>
            <td className="td"><Badge kind="quote" status={r.status} /></td><Right>{fmt(r.total_ttc)}</Right>
          </tr>
        ))}
      </Table>
    </>
  );
}
