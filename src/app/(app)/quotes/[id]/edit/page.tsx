import { notFound, redirect } from "next/navigation";
import { requirePage, can } from "@/lib/auth";
import { formContext, initFromDoc } from "@/lib/formdata";
import { getDoc } from "@/lib/docs";
import DocumentForm from "@/components/DocumentForm";
import { PageHeader } from "@/components/ui";

export default async function EditQuote({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("quotes");
  const { id } = await params;
  const d = await getDoc("quote", Number(id));
  if (!d) notFound();
  if (d.status !== "draft") redirect(`/quotes/${id}`);
  const ctx = await formContext("quote");
  return (<><PageHeader title={`Modifier ${d.number}`} /><DocumentForm kind="quote" {...ctx} init={initFromDoc(d, "quote")} canDiscount={can(user.role, "discount")} /></>);
}
