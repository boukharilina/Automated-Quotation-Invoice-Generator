"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./client";

function useSave() {
  const router = useRouter(); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<any>, okText = "Enregistré.") => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, t: okText }); router.refresh(); } catch (e: any) { setMsg({ ok: false, t: e.message }); } finally { setBusy(false); }
  };
  return { busy, msg, run };
}
const Msg = ({ m }: { m: { ok: boolean; t: string } | null }) => m ? <p role="alert" className={`rounded-lg p-2 text-sm ${m.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{m.t}</p> : null;

export function CompanyForm({ s }: { s: any }) {
  const { busy, msg, run } = useSave();
  const [logo, setLogo] = useState<string>(s.logo);
  const text = (k: string, label: string, wide = false) => (<div className={wide ? "md:col-span-2" : ""}><label className="label">{label}</label><input name={k} defaultValue={s[k]} className="input" /></div>);
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) return alert("PNG ou JPEG uniquement.");
    if (file.size > 600_000) return alert("Logo trop volumineux (max 600 Ko).");
    const r = new FileReader(); r.onload = () => setLogo(String(r.result)); r.readAsDataURL(file);
  }
  return (
    <form className="card grid gap-4 p-5 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); run(() => api("PUT", "/api/settings", { ...f, logo })); }}>
      {text("company_name", "Raison sociale")}{text("tax_id", "Matricule fiscal")}
      {text("company_address", "Adresse", true)}{text("company_phone", "Téléphone")}{text("company_email", "E-mail")}{text("company_web", "Site web")}
      {text("bank_name", "Banque")}{text("rib", "RIB")}
      <div><label className="label">TVA (%)</label><input name="vat_rate" type="number" step="0.01" min="0" max="100" defaultValue={s.vat_rate} className="input" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Validité devis (jours)</label><input name="quote_validity_days" type="number" min="1" defaultValue={s.quote_validity_days} className="input" /></div>
        <div><label className="label">Échéance facture (jours)</label><input name="invoice_due_days" type="number" min="0" defaultValue={s.invoice_due_days} className="input" /></div>
      </div>
      <div className="md:col-span-2"><label className="label">Conditions par défaut – devis</label><textarea name="quote_conditions" rows={3} defaultValue={s.quote_conditions} className="input" /></div>
      <div className="md:col-span-2"><label className="label">Conditions par défaut – factures</label><textarea name="invoice_conditions" rows={3} defaultValue={s.invoice_conditions} className="input" /></div>
      <div className="md:col-span-2"><label className="label">Logo (PNG/JPEG, fond transparent ou blanc recommandé)</label>
        <div className="flex flex-wrap items-center gap-4">{logo && <img src={logo} alt="Logo" className="max-h-14 rounded border bg-white p-1" />}
          <input type="file" accept="image/png,image/jpeg" onChange={onFile} className="text-sm" />{logo && <button type="button" className="btn-ghost" onClick={() => setLogo("")}>Retirer</button>}</div></div>
      <div className="space-y-2 md:col-span-2"><Msg m={msg} /><button className="btn-primary" disabled={busy}>Enregistrer les paramètres</button>
        <p className="text-xs text-slate-500">Le taux de TVA s&apos;applique aux nouveaux documents ; les documents existants conservent leur taux d&apos;origine.</p></div>
    </form>
  );
}

export function ServicesEditor({ services }: { services: any[] }) {
  const { busy, msg, run } = useSave();
  const row = (s: any) => (
    <form key={s.id ?? "new"} className="grid gap-2 border-b border-slate-100 p-3 md:grid-cols-[1fr_1fr_130px_80px_auto] md:items-end"
      onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const body = { name: f.get("name"), description: f.get("description"), unit_price: Number(f.get("unit_price")), active: f.get("active") === "on" };
        run(() => s.id ? api("PUT", `/api/services/${s.id}`, body) : api("POST", "/api/services", body).then(() => (e.target as HTMLFormElement).reset())); }}>
      <div><label className="label">Service</label><input name="name" required defaultValue={s.name} className="input" /></div>
      <div><label className="label">Description</label><input name="description" defaultValue={s.description} className="input" /></div>
      <div><label className="label">Prix HT (TND)</label><input name="unit_price" type="number" step="0.001" min="0" required defaultValue={s.unit_price ?? 0} className="input text-right" /></div>
      <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={s.active ?? true} /> Actif</label>
      <button className="btn-primary" disabled={busy}>{s.id ? "Enregistrer" : "Ajouter"}</button>
    </form>
  );
  return (<div className="card"><Msg m={msg} />{services.map(row)}<div className="bg-slate-50">{row({})}</div></div>);
}

export function UsersEditor({ users, meId }: { users: any[]; meId: number }) {
  const { busy, msg, run } = useSave();
  const row = (u: any) => (
    <form key={u.id ?? "new"} className="grid gap-2 border-b border-slate-100 p-3 md:grid-cols-[1fr_1.2fr_150px_1fr_70px_auto] md:items-end"
      onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const body = { name: f.get("name"), email: f.get("email"), role: f.get("role"), password: f.get("password") || "", active: f.get("active") === "on" };
        run(() => u.id ? api("PUT", `/api/users/${u.id}`, body) : api("POST", "/api/users", body).then(() => (e.target as HTMLFormElement).reset()), u.id ? "Utilisateur mis à jour." : "Utilisateur créé."); }}>
      <div><label className="label">Nom</label><input name="name" required defaultValue={u.name} className="input" /></div>
      <div><label className="label">E-mail</label><input name="email" type="email" required defaultValue={u.email} className="input" /></div>
      <div><label className="label">Rôle</label><select name="role" defaultValue={u.role ?? "sales"} className="input"><option value="admin">Administrateur</option><option value="accounting">Comptabilité</option><option value="sales">Équipe commerciale</option></select></div>
      <div><label className="label">{u.id ? "Nouveau mot de passe" : "Mot de passe"}</label><input name="password" type="password" minLength={8} required={!u.id} placeholder={u.id ? "inchangé" : "8 caractères min."} autoComplete="new-password" className="input" /></div>
      <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={u.active ?? true} disabled={u.id === meId} /> Actif</label>
      <button className="btn-primary" disabled={busy}>{u.id ? "Enregistrer" : "Créer"}</button>
    </form>
  );
  return (<div className="card"><Msg m={msg} />{users.map(row)}<div className="bg-slate-50">{row({})}</div></div>);
}
