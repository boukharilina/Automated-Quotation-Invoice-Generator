import { requirePage } from "@/lib/auth";
import { vatDeclaration } from "@/lib/reports";
import { listDeductible, vatBalance } from "@/lib/vat";
import { VatImport } from "@/components/VatImport";
import { fmt, fromM, toM } from "@/lib/money";
import { fmtDate, today } from "@/lib/util";
import { A, PageHeader, Right, Stat, Table } from "@/components/ui";
import { PrintPageButton } from "@/components/DocTools";
import { Download } from "lucide-react";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
/** Somme en millimes pour éviter les erreurs d'arrondi. */
const sum = (list: any[], key: string) => fromM(list.reduce((s, i) => s + toM(i[key]), 0));

export default async function VatPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  await requirePage("vat");
  const sp = await searchParams;
  const [all, purchases] = await Promise.all([vatDeclaration(), listDeductible()]);
  const current = today().slice(0, 4);
  const years = [...new Set([current, ...all.map((i) => String(i.issue_date).slice(0, 4)), ...purchases.map((a) => a.invoice_date.slice(0, 4))])].sort().reverse();
  const year = sp.year && years.includes(sp.year) ? sp.year : current;
  const inYear = all.filter((i) => String(i.issue_date).startsWith(year));
  const months = MONTHS.map((label, k) => {
    const key = `${year}-${String(k + 1).padStart(2, "0")}`;
    return { key, label, list: inYear.filter((i) => String(i.issue_date).startsWith(key)), bought: purchases.filter((a) => a.invoice_date.startsWith(key)) };
  });
  // Filtre : ?month=01..12 ; vide = toute l'année.
  const selected = months.find((m) => m.key.slice(5) === sp.month);
  const shown = selected ? [selected] : months;
  const shownInvoices = selected ? selected.list : inYear;
  const shownPurchases = shown.flatMap((m) => m.bought);
  const collected = sum(shownInvoices, "vat_amount");
  const deductible = sum(shownPurchases, "vat_amount");
  const total = vatBalance(collected, deductible);
  const period = `${selected ? `${selected.label} ` : ""}${year}`;

  return (
    <>
      <PageHeader title="Déclaration mensuelle de TVA" subtitle="TVA collectée : factures émises (brouillons et annulées exclus). TVA déductible : achats importés. Rattachement selon la date de facture.">
        <a href={`/api/vat/export?year=${year}`} className="btn-ghost no-print"><Download size={16} /> Excel {year}</a>
        {selected && <a href={`/api/vat/export?month=${selected.key}`} className="btn-ghost no-print"><Download size={16} /> Excel {selected.label}</a>}
        <PrintPageButton />
      </PageHeader>
      <form key={`${year}-${sp.month ?? ""}`} className="no-print mb-4 flex flex-wrap gap-2">
        <select name="year" defaultValue={year} className="input !w-auto" aria-label="Année">{years.map((y) => <option key={y}>{y}</option>)}</select>
        <select name="month" defaultValue={selected?.key.slice(5) ?? ""} className="input !w-auto" aria-label="Mois">
          <option value="">Tous les mois</option>
          {MONTHS.map((label, k) => <option key={label} value={String(k + 1).padStart(2, "0")}>{label}</option>)}
        </select>
        <button className="btn-ghost">Filtrer</button>
      </form>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="TVA collectée" value={fmt(collected)} hint={period} />
        <Stat label="TVA déductible" value={fmt(deductible)} hint={`${shownPurchases.length} achat(s) importé(s)`} />
        {total.credit > 0
          ? <Stat label="Crédit de TVA" value={fmt(total.credit)} hint="Collectée < déductible" tone="green" />
          : <Stat label="TVA à payer" value={fmt(total.payable)} hint="Collectée − déductible" tone="red" />}
      </div>

      <VatImport month={selected?.key} monthLabel={selected ? period : undefined} />

      <Table head={["Mois", { t: "Factures", right: true }, { t: "Total HT", right: true }, { t: "TVA collectée", right: true }, { t: "TVA déductible", right: true }, { t: "TVA à payer", right: true }, { t: "Crédit de TVA", right: true }, { t: "Timbre fiscal", right: true }, { t: "Total TTC", right: true }]}>
        {shown.map((m) => {
          const b = vatBalance(sum(m.list, "vat_amount"), sum(m.bought, "vat_amount"));
          return (
            <tr key={m.key} className={m.key === selected?.key ? "bg-brand-50" : undefined}>
              <td className="td">{m.list.length || m.bought.length ? <A href={`/vat?year=${year}&month=${m.key.slice(5)}`}>{m.label} {year}</A> : <span className="text-slate-400">{m.label} {year}</span>}</td>
              <Right>{m.list.length}</Right>
              <Right>{fmt(sum(m.list, "total_ht"))}</Right>
              <Right>{fmt(sum(m.list, "vat_amount"))}</Right>
              <Right>{fmt(sum(m.bought, "vat_amount"))}</Right>
              <Right><strong>{fmt(b.payable)}</strong></Right>
              <Right><strong>{fmt(b.credit)}</strong></Right>
              <Right>{fmt(sum(m.list, "stamp_duty"))}</Right>
              <Right>{fmt(sum(m.list, "total_ttc"))}</Right>
            </tr>
          );
        })}
        <tr key="total" className="border-t-2 border-brand font-bold">
          <td className="td">Total {period}</td>
          <Right>{shownInvoices.length}</Right>
          <Right>{fmt(sum(shownInvoices, "total_ht"))}</Right>
          <Right>{fmt(collected)}</Right>
          <Right>{fmt(deductible)}</Right>
          <Right>{fmt(total.payable)}</Right>
          <Right>{fmt(total.credit)}</Right>
          <Right>{fmt(sum(shownInvoices, "stamp_duty"))}</Right>
          <Right>{fmt(sum(shownInvoices, "total_ttc"))}</Right>
        </tr>
      </Table>

      {selected && (
        <>
          <h2 className="mb-2 mt-8 text-lg font-semibold text-brand">TVA collectée : {selected.label} {year}</h2>
          <Table head={["Facture", "Date", "Client", "CIN / Passeport", { t: "Total HT", right: true }, { t: "Taux", right: true }, { t: "TVA", right: true }]} empty="Aucune facture ce mois.">
            {selected.list.map((i) => (
              <tr key={i.id}>
                <td className="td"><A href={`/invoices/${i.id}`}>{i.number}</A></td>
                <td className="td">{fmtDate(i.issue_date)}</td>
                <td className="td">{i.customer_name}</td>
                <td className="td">{i.cin_passport || "—"}</td>
                <Right>{fmt(i.total_ht)}</Right>
                <Right>{Number(i.vat_rate)} %</Right>
                <Right>{fmt(i.vat_amount)}</Right>
              </tr>
            ))}
          </Table>

          <h2 className="mb-2 mt-8 text-lg font-semibold text-brand">TVA déductible : {selected.label} {year}</h2>
          <Table head={["Date", "Fournisseur", "N° facture", { t: "Montant HT", right: true }, { t: "TVA déductible", right: true }]} empty="Aucun achat importé ce mois.">
            {selected.bought.map((a) => (
              <tr key={a.id}>
                <td className="td">{fmtDate(a.invoice_date)}</td>
                <td className="td">{a.supplier || "—"}</td>
                <td className="td">{a.reference || "—"}</td>
                <Right>{fmt(a.amount_ht)}</Right>
                <Right>{fmt(a.vat_amount)}</Right>
              </tr>
            ))}
          </Table>
        </>
      )}
    </>
  );
}
