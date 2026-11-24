"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./client";

export default function CustomerForm({ init, id }: { init?: any; id?: number }) {
  const router = useRouter(); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setOk(false); setBusy(true);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (id) { await api("PUT", `/api/customers/${id}`, body); setOk(true); router.refresh(); }
      else { const r = await api("POST", "/api/customers", body); router.push(`/customers/${r.id}`); router.refresh(); }
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  const f = (n: string) => init?.[n] ?? "";
  return (
    <form onSubmit={submit} className="card grid gap-4 p-5 md:grid-cols-2">
      <div><label className="label">Nom complet *</label><input name="full_name" required defaultValue={f("full_name")} className="input" /></div>
      <div><label className="label">Téléphone</label><input name="phone" defaultValue={f("phone")} className="input" /></div>
      <div><label className="label">E-mail</label><input name="email" type="email" defaultValue={f("email")} className="input" /></div>
      <div><label className="label">CIN / Passeport</label><input name="cin_passport" defaultValue={f("cin_passport")} className="input" /></div>
      <div><label className="label">Nom de l&apos;étudiant (si différent)</label><input name="student_name" defaultValue={f("student_name")} className="input" /></div>
      <div><label className="label">Adresse</label><input name="address" defaultValue={f("address")} className="input" /></div>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700 md:col-span-2">{err}</p>}
      {ok && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700 md:col-span-2">Modifications enregistrées.</p>}
      <div className="md:col-span-2"><button className="btn-primary" disabled={busy}>{id ? "Enregistrer" : "Créer le client"}</button></div>
    </form>
  );
}
