"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, UserPlus, Search } from "lucide-react";
import { api } from "./client";
import { computeTotals, fmt, lineTotal } from "@/lib/money";

interface Item { free?: boolean; service_id: number | null; description: string; quantity: number | string; unit_price: number | string }
interface Cust { id: number; code: string; full_name: string; phone?: string; email?: string; student_name?: string }
export interface DocInit {
  id?: number; customer?: Cust | null; issue_date: string; second_date: string; payment_method?: string;
  notes: string; conditions: string; discount: number; extra_charges: number; items: Item[];
}
interface Props {
  kind: "quote" | "invoice"; services: { id: number; name: string; unit_price: number }[]; vatRate: number;
  canDiscount: boolean; init: DocInit;
}

export default function DocumentForm({ kind, services, vatRate, canDiscount, init }: Props) {
  const router = useRouter();
  const isQ = kind === "quote";
  const [customer, setCustomer] = useState<Cust | null>(init.customer ?? null);
  const [items, setItems] = useState<Item[]>(init.items.map((i) => ({ ...i, free: !i.service_id && !!i.description })));
  const [issue, setIssue] = useState(init.issue_date);
  const [second, setSecond] = useState(init.second_date);
  const [method, setMethod] = useState(init.payment_method ?? "bank_transfer");
  const [notes, setNotes] = useState(init.notes);
  const [conditions, setConditions] = useState(init.conditions);
  const [discount, setDiscount] = useState<number | string>(init.discount);
  const [extra, setExtra] = useState<number | string>(init.extra_charges);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const totals = useMemo(() => computeTotals(
    items.map((i) => ({ quantity: Number(i.quantity) || 0, unit_price: Number(i.unit_price) || 0 })), Number(discount) || 0, Number(extra) || 0, vatRate), [items, discount, extra, vatRate]);

  const setItem = (i: number, patch: Partial<Item>) => setItems((a) => a.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const pickService = (i: number, id: number) => {
    const s = services.find((x) => x.id === id); if (!s) return;
    setItem(i, { service_id: s.id, description: s.name, unit_price: s.unit_price });
  };

  async function save(status: string) {
    setErr("");
    if (!customer) return setErr("Sélectionnez ou créez un client.");
    setBusy(true);
    const body = {
      customer_id: customer.id, issue_date: issue, notes, conditions, discount: Number(discount) || 0, extra_charges: Number(extra) || 0, status,
      ...(isQ ? { valid_until: second } : { due_date: second, payment_method: method }),
      items: items.map((i) => ({ service_id: i.service_id, description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
    };
    try {
      const base = isQ ? "/api/quotes" : "/api/invoices";
      const r = init.id ? await api("PUT", `${base}/${init.id}`, body) : await api("POST", base, body);
      router.push(`/${isQ ? "quotes" : "invoices"}/${r.id}`); router.refresh();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold text-brand">1. Client</h2>
          <CustomerPicker value={customer} onChange={setCustomer} />
        </section>

        <section className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-brand">2. Services</h2>
          </div>
          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_90px_130px_120px_36px] md:items-end">
                <div><label className="label">Désignation</label>
                  {it.free
                    ? <input className="input" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="Description libre" />
                    : <select className="input" value={it.service_id ?? ""} onChange={(e) => pickService(i, Number(e.target.value))} aria-label="Service">
                        <option value="" disabled>Choisir un service…</option>
                        {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>}
                </div>
                <div><label className="label">Qté</label><input className="input text-right" type="number" min="0.001" step="any" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} /></div>
                <div><label className="label">Prix unit. HT</label><input className="input text-right" type="number" min="0" step="0.001" value={it.unit_price} onChange={(e) => setItem(i, { unit_price: e.target.value })} /></div>
                <div><label className="label">Total HT</label><div className="px-1 py-2 text-right text-sm font-semibold tabular-nums">{fmt(lineTotal({ quantity: Number(it.quantity) || 0, unit_price: Number(it.unit_price) || 0 }))}</div></div>
                <button type="button" className="btn-danger !p-2" onClick={() => setItems((a) => a.filter((_, k) => k !== i))} aria-label="Supprimer la ligne" disabled={items.length === 1}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => setItems((a) => [...a, { service_id: null, description: "", quantity: 1, unit_price: 0 }])}><Plus size={16} /> Ajouter un service</button>
            <button type="button" className="btn-ghost" onClick={() => setItems((a) => [...a, { free: true, service_id: null, description: "", quantity: 1, unit_price: 0 }])}><Plus size={16} /> Ligne libre</button>
          </div>
        </section>

        <section className="card grid gap-4 p-5 md:grid-cols-2">
          <h2 className="font-semibold text-brand md:col-span-2">3. Dates et conditions</h2>
          <div><label className="label">Date d&apos;émission</label><input type="date" className="input" value={issue} onChange={(e) => setIssue(e.target.value)} /></div>
          <div><label className="label">{isQ ? "Valable jusqu'au" : "Date d'échéance"}</label><input type="date" className="input" value={second} onChange={(e) => setSecond(e.target.value)} /></div>
          {!isQ && (
            <div><label className="label">Mode de paiement</label>
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="bank_transfer">Virement bancaire</option><option value="cash">Espèces</option><option value="check">Chèque</option><option value="other">Autre</option>
              </select></div>
          )}
          <div className="md:col-span-2"><label className="label">Description / conditions particulières (optionnel)</label><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="md:col-span-2"><label className="label">Conditions de paiement</label><textarea className="input" rows={3} value={conditions} onChange={(e) => setConditions(e.target.value)} /></div>
        </section>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold text-brand">Récapitulatif</h2>
          {canDiscount && (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Remise (HT)</label><input type="number" min="0" step="0.001" className="input text-right" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
              <div><label className="label">Frais add. (HT)</label><input type="number" min="0" step="0.001" className="input text-right" value={extra} onChange={(e) => setExtra(e.target.value)} /></div>
            </div>
          )}
          <dl className="space-y-1.5 text-sm tabular-nums">
            <Row k="Sous-total HT" v={fmt(totals.subtotal_ht)} />
            {totals.discount > 0 && <Row k="Remise" v={"- " + fmt(totals.discount)} />}
            {totals.extra_charges > 0 && <Row k="Frais additionnels" v={fmt(totals.extra_charges)} />}
            <Row k="Total HT" v={fmt(totals.total_ht)} />
            <Row k={`TVA ${vatRate} %`} v={fmt(totals.vat_amount)} />
            <div className="flex justify-between rounded-lg bg-brand px-3 py-2.5 text-base font-bold text-white"><dt>Total TTC</dt><dd>{fmt(totals.total_ttc)}</dd></div>
          </dl>
          {err && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
          <div className="grid gap-2">
            <button className="btn-accent" disabled={busy} onClick={() => save(isQ ? "sent" : "issued")}>{isQ ? "Enregistrer et marquer « Envoyé »" : "Émettre la facture"}</button>
            <button className="btn-ghost" disabled={busy} onClick={() => save("draft")}>Enregistrer en brouillon</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><dt className="text-slate-500">{k}</dt><dd>{v}</dd></div>;

function CustomerPicker({ value, onChange }: { value: Cust | null; onChange: (c: Cust | null) => void }) {
  const [q, setQ] = useState(""); const [res, setRes] = useState<Cust[]>([]); const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false); const [err, setErr] = useState("");
  const t = useRef<any>(null);
  useEffect(() => {
    if (!open) return; clearTimeout(t.current);
    t.current = setTimeout(() => api<Cust[]>("GET", `/api/customers?q=${encodeURIComponent(q)}`).then(setRes).catch(() => {}), 200);
    return () => clearTimeout(t.current);
  }, [q, open]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr("");
    const f = Object.fromEntries(new FormData(e.currentTarget)) as any;
    try { const c = await api<Cust>("POST", "/api/customers", f); onChange(c); setCreating(false); } catch (x: any) { setErr(x.message); }
  }

  if (value && !creating) return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-50 p-3">
      <div><div className="font-semibold">{value.full_name} <span className="text-xs font-normal text-slate-500">{value.code}</span></div>
        <div className="text-xs text-slate-500">{[value.phone, value.email, value.student_name && `Étudiant : ${value.student_name}`].filter(Boolean).join(" · ")}</div></div>
      <button type="button" className="btn-ghost !py-1" onClick={() => onChange(null)}>Changer</button>
    </div>
  );
  if (creating) return (
    <form onSubmit={create} className="grid gap-3 md:grid-cols-2">
      <div><label className="label">Nom complet *</label><input name="full_name" required className="input" /></div>
      <div><label className="label">Téléphone</label><input name="phone" className="input" /></div>
      <div><label className="label">E-mail</label><input name="email" type="email" className="input" /></div>
      <div><label className="label">Nom de l&apos;étudiant (si différent)</label><input name="student_name" className="input" /></div>
      <div className="md:col-span-2"><label className="label">Adresse</label><input name="address" className="input" /></div>
      {err && <p className="text-sm text-red-700 md:col-span-2">{err}</p>}
      <div className="flex gap-2 md:col-span-2"><button className="btn-primary">Créer le client</button><button type="button" className="btn-ghost" onClick={() => setCreating(false)}>Annuler</button></div>
    </form>
  );
  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="input !pl-9" placeholder="Rechercher un client (nom, téléphone, e-mail, code)…" value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} /></div>
        <button type="button" className="btn-ghost" onClick={() => setCreating(true)}><UserPlus size={16} /> Nouveau</button>
      </div>
      {open && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {res.length === 0 && <li className="p-3 text-sm text-slate-500">Aucun client trouvé.</li>}
          {res.map((c) => (
            <li key={c.id}><button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50" onClick={() => { onChange(c); setOpen(false); }}>
              <span className="font-medium">{c.full_name}</span> <span className="text-xs text-slate-500">{c.code} {c.phone}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
