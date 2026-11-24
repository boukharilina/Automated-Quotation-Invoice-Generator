import { requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Table } from "@/components/ui";

const ACTIONS: Record<string, string> = { create: "Création", update: "Modification", status: "Changement de statut", payment: "Paiement", convert: "Conversion", login: "Connexion" };
const ENT: Record<string, string> = { quote: "Devis", invoice: "Facture", customer: "Client", service: "Service", user: "Utilisateur", settings: "Paramètres" };

export default async function Audit({ searchParams }: { searchParams: Promise<{ entity?: string; page?: string }> }) {
  await requirePage("audit");
  const { entity = "", page = "1" } = await searchParams;
  const p = Math.max(1, Number(page) || 1), size = 100;
  const db = await getDb();
  const rows = (await db.query<any>("SELECT * FROM audit_log WHERE ($1='' OR entity=$1) ORDER BY id DESC LIMIT $2 OFFSET $3", [entity, size, (p - 1) * size])).rows;
  const fmtAt = (d: Date) => new Date(d).toLocaleString("fr-FR", { timeZone: "Africa/Tunis" });
  const link = (n: number) => `?entity=${entity}&page=${n}`;
  return (
    <>
      <PageHeader title="Journal d'audit" subtitle="Historique inaltérable des opérations (création, modification, statuts, paiements, conversions)." />
      <form className="mb-4 flex gap-2"><select name="entity" defaultValue={entity} className="input !w-auto"><option value="">Toutes les entités</option>{Object.entries(ENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><button className="btn-ghost">Filtrer</button></form>
      <Table head={["Date", "Utilisateur", "Action", "Entité", "Détails"]} empty="Aucune entrée.">
        {rows.map((r) => (
          <tr key={r.id} className="align-top"><td className="td whitespace-nowrap">{fmtAt(r.at)}</td><td className="td">{r.user_name}</td><td className="td">{ACTIONS[r.action] ?? r.action}</td>
            <td className="td whitespace-nowrap">{ENT[r.entity] ?? r.entity} #{r.entity_id}</td>
            <td className="td max-w-md break-words font-mono text-xs text-slate-600">{JSON.stringify(r.details)}</td></tr>
        ))}
      </Table>
      <div className="mt-4 flex gap-2">{p > 1 && <a className="btn-ghost" href={link(p - 1)}>← Précédent</a>}{rows.length === size && <a className="btn-ghost" href={link(p + 1)}>Suivant →</a>}</div>
    </>
  );
}
