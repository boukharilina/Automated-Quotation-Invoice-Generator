import { fmt } from "@/lib/money";
import { fmtDate } from "@/lib/util";

export function DocBody({ d, second }: { d: any; second: { label: string; value: string } }) {
  return (
    <div className="space-y-4">
      <div className="card grid gap-4 p-5 text-sm md:grid-cols-3">
        <div><div className="label">Client</div><div className="font-semibold">{d.customer_name}</div><div className="text-slate-500">{d.customer_code}</div>
          <div className="text-slate-500">CIN / Passeport : {d.customer_cin || "—"}</div>
          {d.customer_student && d.customer_student !== d.customer_name && <div className="text-slate-500">Étudiant : {d.customer_student}</div>}
          <div className="text-slate-500">{[d.customer_phone, d.customer_email].filter(Boolean).join(" · ")}</div></div>
        <div><div className="label">Date d&apos;émission</div>{fmtDate(d.issue_date)}</div>
        <div><div className="label">{second.label}</div>{second.value}</div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b bg-slate-50"><tr><th className="th">Désignation</th><th className="th text-right">Qté</th><th className="th text-right">Prix unit. HT</th><th className="th text-right">Total HT</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {d.items.map((i: any) => (<tr key={i.id}><td className="td">{i.description}</td><td className="td text-right tabular-nums">{i.quantity}</td><td className="td text-right tabular-nums">{fmt(i.unit_price)}</td><td className="td text-right font-medium tabular-nums">{fmt(i.line_total)}</td></tr>))}
          </tbody>
        </table>
        <dl className="ml-auto w-full max-w-xs space-y-1 p-4 text-sm tabular-nums">
          <Line k="Sous-total HT" v={fmt(d.subtotal_ht)} />
          {d.discount > 0 && <Line k="Remise" v={"- " + fmt(d.discount)} />}
          {d.extra_charges > 0 && <Line k="Frais additionnels" v={fmt(d.extra_charges)} />}
          <Line k="Total HT" v={fmt(d.total_ht)} /><Line k={`TVA ${d.vat_rate} %`} v={fmt(d.vat_amount)} />
          {d.stamp_duty > 0 && <Line k="Timbre fiscal" v={fmt(d.stamp_duty)} />}
          <div className="flex justify-between border-t pt-2 text-base font-bold text-brand"><dt>Total TTC</dt><dd>{fmt(d.total_ttc)}</dd></div>
          {d.amount_paid !== undefined && d.amount_paid > 0 && <><Line k="Déjà réglé" v={fmt(d.amount_paid)} /><div className="flex justify-between font-bold text-accent"><dt>Reste à payer</dt><dd>{fmt(d.total_ttc - d.amount_paid)}</dd></div></>}
        </dl>
      </div>
      {(d.notes || d.conditions) && (
        <div className="card space-y-3 p-5 text-sm">
          {d.notes && <div><div className="label">Description / conditions particulières</div><p className="whitespace-pre-line">{d.notes}</p></div>}
          {d.conditions && <div><div className="label">Conditions de paiement</div><p className="whitespace-pre-line text-slate-600">{d.conditions}</p></div>}
        </div>
      )}
    </div>
  );
}
const Line = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><dt className="text-slate-500">{k}</dt><dd>{v}</dd></div>;
