import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/util";
import { A, PageHeader, Table } from "@/components/ui";

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePage("customers");
  const { q = "" } = await searchParams;
  const db = await getDb();
  const rows = (await db.query<any>(
    `SELECT * FROM customers WHERE $1='' OR full_name ILIKE $2 OR code ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2 OR student_name ILIKE $2 OR cin_passport ILIKE $2 ORDER BY id DESC LIMIT 300`, [q, `%${q}%`])).rows;
  return (
    <>
      <PageHeader title="Clients" subtitle={`${rows.length} client(s)`}><Link href="/customers/new" className="btn-accent"><Plus size={16} /> Nouveau client</Link></PageHeader>
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={q} placeholder="Nom, téléphone, e-mail, code, CIN…" className="input !w-80" /><button className="btn-ghost">Rechercher</button></form>
      <Table head={["Code", "Nom", "Téléphone", "E-mail", "Étudiant", "Inscription"]} empty="Aucun client.">
        {rows.map((c) => (
          <tr key={c.id} className="hover:bg-slate-50"><td className="td">{c.code}</td><td className="td"><A href={`/customers/${c.id}`}>{c.full_name}</A></td>
            <td className="td">{c.phone}</td><td className="td">{c.email}</td><td className="td">{c.student_name}</td><td className="td">{fmtDate(c.registered_at)}</td></tr>
        ))}
      </Table>
    </>
  );
}
