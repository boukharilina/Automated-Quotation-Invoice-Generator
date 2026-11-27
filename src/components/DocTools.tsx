"use client";
import { useState } from "react";
import { Mail, Printer } from "lucide-react";
import { api } from "./client";

/** Charge le PDF dans un cadre invisible puis ouvre la boîte de dialogue d'impression. */
export function PrintPdfButton({ url }: { url: string }) {
  function print() {
    document.getElementById("print-frame")?.remove();
    const f = document.createElement("iframe");
    f.id = "print-frame";
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    f.onload = () => { f.contentWindow?.focus(); f.contentWindow?.print(); };
    f.src = url;
    document.body.appendChild(f);
  }
  return <button type="button" className="btn-ghost" onClick={print}><Printer size={16} /> Imprimer</button>;
}

/** Impression de la page affichée (menu et boutons masqués par la feuille de style). */
export function PrintPageButton() {
  return <button type="button" className="btn-ghost no-print" onClick={() => window.print()}><Printer size={16} /> Imprimer</button>;
}

export function EmailButton({ url, email }: { url: string; email: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function send() {
    if (!confirm(`Envoyer le PDF par e-mail à ${email} ?`)) return;
    setBusy(true); setMsg(null);
    try { const r = await api<{ to: string }>("POST", url); setMsg({ ok: true, t: `E-mail envoyé à ${r.to}.` }); }
    catch (e: any) { setMsg({ ok: false, t: e.message }); }
    finally { setBusy(false); }
  }
  return (
    <>
      <button type="button" className="btn-primary" disabled={busy || !email} onClick={send} title={email ? `Envoyer à ${email}` : "Aucune adresse e-mail sur la fiche client"}>
        <Mail size={16} /> {busy ? "Envoi…" : "Envoyer par e-mail"}
      </button>
      {msg && <p role="alert" className={`w-full rounded-lg p-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{msg.t}</p>}
    </>
  );
}
