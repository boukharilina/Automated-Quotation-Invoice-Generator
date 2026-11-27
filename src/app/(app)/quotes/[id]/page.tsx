import { notFound } from "next/navigation";
import Link from "next/link";
import { Download, Pencil } from "lucide-react";
import { requirePage, can } from "@/lib/auth";
import { getDoc } from "@/lib/docs";
import { fmt } from "@/lib/money";
import { fmtDate } from "@/lib/util";
import { A, Badge, PageHeader } from "@/components/ui";
import { QuoteActions } from "@/components/Actions";
import { DocBody } from "@/components/DocBody";
import { EmailButton, PrintPdfButton } from "@/components/DocTools";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("quotes");
  const d = await getDoc("quote", Number((await params).id));
  if (!d) notFound();
  return (
    <>
      <PageHeader title={d.number} subtitle={<>Client : <A href={`/customers/${d.customer_id}`}>{d.customer_name}</A> · <Badge kind="quote" status={d.status} /></>}>
        {d.status === "draft" && <Link href={`/quotes/${d.id}/edit`} className="btn-ghost"><Pencil size={16} /> Modifier</Link>}
        <a href={`/api/quotes/${d.id}/pdf`} target="_blank" className="btn-ghost"><Download size={16} /> PDF</a>
        <PrintPdfButton url={`/api/quotes/${d.id}/pdf`} />
        {!["draft", "cancelled"].includes(d.status) && <EmailButton url={`/api/quotes/${d.id}/email`} email={d.customer_email} />}
        <QuoteActions id={d.id} status={d.status} canConvert={can(user.role, "invoices")} invoice={d.invoice} />
      </PageHeader>
      {d.invoice && <p className="mb-4 rounded-lg bg-violet-50 p-3 text-sm text-violet-800">Converti en facture <A href={`/invoices/${d.invoice.id}`}>{d.invoice.number}</A>.</p>}
      <DocBody d={d} second={{ label: "Valable jusqu'au", value: fmtDate(d.valid_until) }} />
      <p className="mt-4 text-xs text-slate-500">Total TTC : {fmt(d.total_ttc)}</p>
    </>
  );
}
