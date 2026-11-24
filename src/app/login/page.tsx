"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/client";

export default function Login() {
  const router = useRouter();
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    try { await api("POST", "/api/auth/login", { email: f.get("email"), password: f.get("password") }); router.push("/"); router.refresh(); }
    catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-8">
        <div className="flex items-center gap-3"><span className="h-10 w-2 rounded bg-accent" /><div><div className="text-2xl font-extrabold tracking-wide text-brand">EDUTEST</div><div className="text-xs text-slate-500">Devis &amp; Factures</div></div></div>
        <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" required autoFocus autoComplete="username" className="input" /></div>
        <div><label className="label" htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" required autoComplete="current-password" className="input" /></div>
        {err && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
      </form>
    </div>
  );
}
