import { requirePage } from "@/lib/auth";
import { vatDeclaration } from "@/lib/reports";
import { fmt, fromM, toM } from "@/lib/money";
import { fmtDate, today } from "@/lib/util";
import { A, PageHeader, Right, Table } from "@/components/ui";
import { PrintPageButton } from "@/components/DocTools";
import { Download } from "lucide-react";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
/** Somme en millimes pour éviter les erreurs d'arrondi. */
const sum = (list: any[], key: string) => fromM(list.reduce((s, i) => s + toM(i[key]), 0));

export default async function VatPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  await requirePage("vat");
  const sp = await searchParams;
  const all = await vatDeclaration();
  const current = today().slice(0, 4);
  const years = [...new Set([current, ...all.map((i) => String(i.issue_date).slice(0, 4))])].sort().reverse();
  const year = sp.year && years.includes(sp.year) ? sp.year : current;
  const inYear = all.filter((i) => String(i.issue_date).startsWith(year));
  const months = MONTHS.map((label, k) => {
    const key = `${year}-${String(k + 1).padStart(2, "0")}`;
    return { key, label, list: inYear.filter((i) => String(i.issue_date).startsWith(key)) };
  });
  const selected = months.find((m) => m.key === sp.month);

  return (
    <>
      <PageHeader title="Déclaration mensuelle TVA collectée" subtitle="Calculée à partir des factures émises (brouillons et factures annulées exclus), selon la date de facture.">
        <a href={`/api/vat/export?year=${year}`} className="btn-ghost no-print"><Download size={16} /> Excel {year}</a>
        {selected && <a href={`/api/vat/export?month=${selected.key}`} className="btn-ghost no-print"><Download size={16} /> Excel {selected.label}</a>}
        <PrintPageButton />
      </PageHeader>
      <form className="no-print mb-4 flex flex-wrap gap-2">
        <select name="year" defaultValue={year} className="input !w-auto" aria-label="Année">{years.map((y) => <option key={y}>{y}</option>)}</select>
        <button className="btn-ghost">Afficher</button>
      </form>

      <Table head={["Mois", { t: "Factures", right: true }, { t: "Total HT", right: true }, { t: "TVA collectée", right: true }, { t: "Timbre fiscal", right: true }, { t: "Total TTC", right: true }]}>
        {months.map((m) => (
          <tr key={m.key} className={m.key === selected?.key ? "bg-brand-50" : undefined}>
            <td className="td">{m.list.length ? <A href={`/vat?year=${year}&month=${m.key}`}>{m.label} {year}</A> : <span className="text-slate-400">{m.label} {year}</span>}</td>
            <Right>{m.list.length}</Right>
            <Right>{fmt(sum(m.list, "total_ht"))}</Right>
            <Right><strong>{fmt(sum(m.list, "vat_amount"))}</strong></Right>
            <Right>{fmt(sum(m.list, "stamp_duty"))}</Right>
            <Right>{fmt(sum(m.list, "total_ttc"))}</Right>
          </tr>
        ))}
        <tr key="total" className="border-t-2 border-brand font-bold">
          <td className="td">Total {year}</td>
          <Right>{inYear.length}</Right>
          <Right>{fmt(sum(inYear, "total_ht"))}</Right>
          <Right>{fmt(sum(inYear, "vat_amount"))}</Right>
          <Right>{fmt(sum(inYear, "stamp_duty"))}</Right>
          <Right>{fmt(sum(inYear, "total_ttc"))}</Right>
        </tr>
      </Table>

      {selected && (
        <>
          <h2 className="mb-2 mt-8 text-lg font-semibold text-brand">Détail : {selected.label} {year}</h2>
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
        </>
      )}
    </>
  );
}
