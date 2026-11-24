"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./client";
import { fmt } from "@/lib/money";

function useAct() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const run = async (fn: () => Promise<any>, confirmMsg?: string, goto?: (r: any) => string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true); setErr("");
    try { const r = await fn(); if (goto) router.push(goto(r)); router.refresh(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return { busy, err, run };
}
const ErrBox = ({ err }: { err: string }) => err ? <p role="alert" className="w-full rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p> : null;

export function QuoteActions({ id, status, canConvert, invoice }: { id: number; status: string; canConvert: boolean; invoice: any }) {
  const { busy, err, run } = useAct();
  const set = (s: string) => run(() => api("POST", `/api/quotes/${id}/status`, { status: s }));
  return (
    <>
      {status === "draft" && <button disabled={busy} className="btn-primary" onClick={() => set("sent")}>Marquer « Envoyé »</button>}
      {["draft", "sent"].includes(status) && <button disabled={busy} className="btn-ghost" onClick={() => set("accepted")}>Accepté</button>}
      {["draft", "sent"].includes(status) && <button disabled={busy} className="btn-danger" onClick={() => set("rejected")}>Refusé</button>}
      {["rejected", "expired", "sent"].includes(status) && <button disabled={busy} className="btn-ghost" onClick={() => set("draft")}>Remettre en brouillon</button>}
      {status === "accepted" && !invoice && canConvert && (
        <button disabled={busy} className="btn-accent" onClick={() => run(() => api("POST", `/api/quotes/${id}/convert`), "Convertir ce devis en facture ?", (r) => `/invoices/${r.id}`)}>Convertir en facture</button>
      )}
      <ErrBox err={err} />
    </>
  );
}

export function InvoiceActions({ id, status, paid }: { id: number; status: string; paid: number }) {
  const { busy, err, run } = useAct();
  return (
    <>
      {status === "draft" && <button disabled={busy} className="btn-primary" onClick={() => run(() => api("POST", `/api/invoices/${id}/status`, { status: "issued" }))}>Émettre</button>}
      {status !== "cancelled" && paid === 0 && (
        <button disabled={busy} className="btn-danger" onClick={() => run(() => api("POST", `/api/invoices/${id}/status`, { status: "cancelled" }), "Annuler cette facture ? Cette action est irréversible.")}>Annuler la facture</button>
      )}
      <ErrBox err={err} />
    </>
  );
}

export function PaymentForm({ invoiceId, remaining, today }: { invoiceId: number; remaining: number; today: string }) {
  const { busy, err, run } = useAct();
  const [amount, setAmount] = useState(String(remaining));
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as any;
    await run(() => api("POST", `/api/invoices/${invoiceId}/payments`, { ...f, amount: Number(f.amount) }).then((r) => { setAmount(""); window.open(`/api/payments/${r.id}/pdf`, "_blank"); return r; }));
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div><label className="label">Montant (TND)</label><input name="amount" type="number" step="0.001" min="0.001" max={remaining} required value={amount} onChange={(e) => setAmount(e.target.value)} className="input text-right" /></div>
      <div><label className="label">Mode</label><select name="method" className="input"><option value="bank_transfer">Virement bancaire</option><option value="cash">Espèces</option><option value="check">Chèque</option><option value="other">Autre</option></select></div>
      <div><label className="label">Date</label><input name="paid_on" type="date" defaultValue={today} max={today} required className="input" /></div>
      <div><label className="label">Référence</label><input name="reference" className="input" placeholder="N° chèque, virement…" /></div>
      <div className="flex items-end"><button className="btn-accent w-full" disabled={busy}>Enregistrer ({fmt(Number(amount) || 0)})</button></div>
      <ErrBox err={err} />
    </form>
  );
}
