"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, Upload } from "lucide-react";
import { api } from "./client";

export function VatImport({ month, monthLabel }: { month?: string; monthLabel?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  async function run(fn: () => Promise<string>) {
    setBusy(true); setMsg(null);
    try { setMsg({ ok: true, t: await fn() }); router.refresh(); }
    catch (e: any) { setMsg({ ok: false, t: e.message }); }
    finally { setBusy(false); }
  }

  function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = new FormData(form);
    if (!confirm("Les achats déjà enregistrés pour les mois présents dans ce fichier seront remplacés. Continuer ?")) return;
    run(async () => {
      const res = await fetch("/api/vat/deductible", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Une erreur est survenue.");
      form.reset();
      return `${data.count} ligne(s) importée(s) pour ${data.months.map((m: string) => m.split("-").reverse().join("/")).join(", ")}.`;
    });
  }

  function remove() {
    if (!confirm(`Supprimer tous les achats importés pour ${monthLabel} ?`)) return;
    run(async () => { await api("DELETE", `/api/vat/deductible?month=${month}`); return `Achats de ${monthLabel} supprimés.`; });
  }

  return (
    <div className="card no-print mb-4 p-4">
      <h2 className="font-semibold text-brand">TVA déductible : import Excel des achats</h2>
      <p className="mt-1 text-sm text-slate-500">Colonnes : Date, Fournisseur, N° facture, Montant HT, TVA déductible. Un nouvel import remplace les mois qu&apos;il contient.</p>
      <form onSubmit={upload} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="file" name="file" accept=".xlsx" required className="input !w-auto" aria-label="Fichier Excel des achats" />
        <button className="btn-primary" disabled={busy}><Upload size={16} /> {busy ? "Patientez…" : "Importer"}</button>
        <a href="/api/vat/deductible/template" className="btn-ghost"><Download size={16} /> Modèle Excel</a>
        {month && <button type="button" className="btn-ghost" disabled={busy} onClick={remove}><Trash2 size={16} /> Supprimer les achats de {monthLabel}</button>}
      </form>
      {msg && <p role="alert" className={`mt-2 rounded-lg p-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{msg.t}</p>}
    </div>
  );
}
