import { Download, FileSpreadsheet } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dashboard, parseFilters } from "@/lib/reports";
import { fmt } from "@/lib/money";
import { fmtDate, INVOICE_STATUS } from "@/lib/util";
import { A, Badge, PageHeader, Right, Stat, Table } from "@/components/ui";

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("dashboard");
  const sp = await searchParams;
  const f = parseFilters(sp);
  const db = await getDb();
  const [data, customers, services] = await Promise.all([
    dashboard(f),
    db.query<any>("SELECT id,full_name FROM customers ORDER BY full_name").then((r) => r.rows),
    db.query<any>("SELECT id,name FROM services ORDER BY id").then((r) => r.rows),
  ]);
  const { inv } = data;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const max = Math.max(1, ...data.months.map((m) => Math.max(m.invoiced, m.received)));
  const filtered = Object.keys(f).length > 0;
  return (
    <>
      <PageHeader title="Tableau de bord" subtitle={filtered ? "Résultats filtrés" : "Vue d'ensemble de l'activité"}>
        <a className="btn-ghost" href={`/api/export?format=xlsx&${qs}`}><FileSpreadsheet size={16} /> Excel</a>
        <a className="btn-ghost" href={`/api/export?format=pdf&${qs}`}><Download size={16} /> PDF</a>
      </PageHeader>

      <form className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div><label className="label">Du</label><input type="date" name="from" defaultValue={f.from} className="input" /></div>
        <div><label className="label">Au</label><input type="date" name="to" defaultValue={f.to} className="input" /></div>
        <div><label className="label">Client</label><select name="customer" defaultValue={f.customer ?? ""} className="input"><option value="">Tous</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></div>
        <div><label className="label">Service</label><select name="service" defaultValue={f.service ?? ""} className="input"><option value="">Tous</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label className="label">Statut facture</label><select name="status" defaultValue={f.status ?? ""} className="input"><option value="">Tous</option>{Object.entries(INVOICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label">Paiement</label><select name="pay" defaultValue={f.pay ?? ""} className="input"><option value="">Tous</option><option value="unpaid">Impayées</option><option value="partial">Partielles</option><option value="paid">Soldées</option></select></div>
        <div className="flex items-end gap-2"><button className="btn-primary">Filtrer</button>{filtered && <a href="/" className="btn-ghost">Réinitialiser</a>}</div>
      </form>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Devis générés" value={String(data.quotes)} />
        <Stat label="Factures émises" value={String(inv.issued)} />
        <Stat label="Facturé HT" value={fmt(inv.ht)} />
        <Stat label="Facturé TTC" value={fmt(inv.ttc)} />
        <Stat label="Paiements reçus" value={fmt(inv.paid)} tone="green" />
        <Stat label="Soldes à encaisser" value={fmt(inv.outstanding)} tone="orange" />
        <Stat label="Factures en retard" value={String(inv.overdue_count)} tone={inv.overdue_count ? "red" : undefined} />
        <Stat label="Montant en retard" value={fmt(inv.overdue_amount)} tone={inv.overdue_amount ? "red" : undefined} />
      </div>

      <section className="card mb-6 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-brand">Revenus mensuels (12 derniers mois)</h2>
          <div className="flex gap-4 text-xs text-slate-600"><span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" />Facturé TTC</span><span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" />Encaissé</span></div>
        </div>
        <div className="overflow-x-auto"><div className="flex h-48 min-w-[560px] items-end gap-2" role="img" aria-label="Revenus mensuels : facturé et encaissé">
          {data.months.map((m) => (
            <div key={m.m} className="flex h-full flex-1 flex-col justify-end" title={`${m.m} — facturé ${fmt(m.invoiced)}, encaissé ${fmt(m.received)}`}>
              <div className="flex flex-1 items-end justify-center gap-1">
                <div className="w-1/2 max-w-5 rounded-t bg-brand" style={{ height: `${(m.invoiced / max) * 100}%`, minHeight: m.invoiced ? 2 : 0 }} />
                <div className="w-1/2 max-w-5 rounded-t bg-accent" style={{ height: `${(m.received / max) * 100}%`, minHeight: m.received ? 2 : 0 }} />
              </div>
              <div className="mt-1 text-center text-[10px] text-slate-500">{m.m.slice(5)}/{m.m.slice(2, 4)}</div>
            </div>
          ))}
        </div></div>
        <p className="mt-2 text-xs text-slate-500">Total TTC facturé sur la période : {fmt(data.months.reduce((s, m) => s + m.invoiced, 0))} · encaissé : {fmt(data.months.reduce((s, m) => s + m.received, 0))}</p>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <div><h2 className="mb-2 font-semibold text-brand">Derniers devis</h2>
          <Table head={["N°", "Client", "Statut", { t: "TTC", right: true }]} empty="Aucun devis.">
            {data.recentQuotes.map((q: any) => <tr key={q.id}><td className="td"><A href={`/quotes/${q.id}`}>{q.number}</A></td><td className="td">{q.customer_name}</td><td className="td"><Badge kind="quote" status={q.status} /></td><Right>{fmt(q.total_ttc)}</Right></tr>)}
          </Table></div>
        <div><h2 className="mb-2 font-semibold text-brand">Dernières factures</h2>
          <Table head={["N°", "Client", "Statut", { t: "TTC", right: true }]} empty="Aucune facture.">
            {data.recentInvoices.map((i: any) => <tr key={i.id}><td className="td"><A href={`/invoices/${i.id}`}>{i.number}</A></td><td className="td">{i.customer_name}</td><td className="td"><Badge kind="invoice" status={i.status} /></td><Right>{fmt(i.total_ttc)}</Right></tr>)}
          </Table></div>
      </div>
    </>
  );
}
