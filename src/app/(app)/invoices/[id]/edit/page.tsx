import { notFound, redirect } from "next/navigation";
import { requirePage, can } from "@/lib/auth";
import { formContext, initFromDoc } from "@/lib/formdata";
import { getDoc } from "@/lib/docs";
import DocumentForm from "@/components/DocumentForm";
import { PageHeader } from "@/components/ui";

export default async function EditInvoice({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("invoices");
  const { id } = await params;
  const d = await getDoc("invoice", Number(id));
  if (!d) notFound();
  if (d.status !== "draft") redirect(`/invoices/${id}`);
  const ctx = await formContext("invoice");
  return (<><PageHeader title={`Modifier ${d.number}`} /><DocumentForm kind="invoice" {...ctx} init={initFromDoc(d, "invoice")} canDiscount={can(user.role, "discount")} /></>);
}
