import { notFound } from "next/navigation";
import Link from "next/link";
import { Download, Pencil } from "lucide-react";
import { requirePage, can } from "@/lib/auth";
import { getDoc } from "@/lib/docs";
import { fmt } from "@/lib/money";
import { fmtDate, METHODS, today } from "@/lib/util";
import { A, Badge, PageHeader, Right, Table } from "@/components/ui";
import { InvoiceActions, PaymentForm } from "@/components/Actions";
import { DocBody } from "@/components/DocBody";
import { EmailButton, PrintPdfButton } from "@/components/DocTools";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("invoices");
  const d = await getDoc("invoice", Number((await params).id));
  if (!d) notFound();
  const remaining = Math.round((d.total_ttc - d.amount_paid) * 1000) / 1000;
  const canPay = can(user.role, "payments") && !["draft", "cancelled"].includes(d.status) && remaining > 0;
  return (
    <>
      <PageHeader title={d.number} subtitle={<>Client : <A href={`/customers/${d.customer_id}`}>{d.customer_name}</A> · <Badge kind="invoice" status={d.status} />{d.quote_id && <> · issue du devis <A href={`/quotes/${d.quote_id}`}>{d.quote_number}</A></>}</>}>
        {d.status === "draft" && <Link href={`/invoices/${d.id}/edit`} className="btn-ghost"><Pencil size={16} /> Modifier</Link>}
        <a href={`/api/invoices/${d.id}/pdf`} target="_blank" className="btn-ghost"><Download size={16} /> PDF</a>
        <PrintPdfButton url={`/api/invoices/${d.id}/pdf`} />
        {!["draft", "cancelled"].includes(d.status) && <EmailButton url={`/api/invoices/${d.id}/email`} email={d.customer_email} />}
        <InvoiceActions id={d.id} status={d.status} paid={d.amount_paid} />
      </PageHeader>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Box k="Total TTC" v={fmt(d.total_ttc)} /><Box k="Déjà réglé" v={fmt(d.amount_paid)} tone="text-emerald-700" />
        <Box k="Solde restant" v={d.status === "cancelled" ? "—" : fmt(remaining)} tone={remaining > 0 && d.status !== "cancelled" ? "text-accent" : "text-emerald-700"} />
      </div>
      <DocBody d={d} second={{ label: "Échéance", value: fmtDate(d.due_date) }} />
      <h2 className="mb-2 mt-8 text-lg font-semibold text-brand">Paiements</h2>
      {canPay && <div className="card mb-4 p-5"><PaymentForm invoiceId={d.id} remaining={remaining} today={today()} /></div>}
      <Table head={["Reçu", "Date", "Mode", "Référence", { t: "Montant", right: true }, ""]} empty="Aucun paiement enregistré.">
        {d.payments.map((p: any) => (
          <tr key={p.id}><td className="td">{p.receipt_number}</td><td className="td">{fmtDate(p.paid_on)}</td><td className="td">{METHODS[p.method]}</td><td className="td">{p.reference || "—"}</td>
            <Right>{fmt(p.amount)}</Right><td className="td text-right"><a className="font-medium text-brand hover:underline" target="_blank" href={`/api/payments/${p.id}/pdf`}>Reçu PDF</a></td></tr>
        ))}
      </Table>
    </>
  );
}
const Box = ({ k, v, tone }: { k: string; v: string; tone?: string }) => <div className="card p-4"><div className="label !mb-0">{k}</div><div className={`text-xl font-bold tabular-nums ${tone ?? "text-brand"}`}>{v}</div></div>;
