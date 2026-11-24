import { requirePage, can } from "@/lib/auth";
import { formContext } from "@/lib/formdata";
import DocumentForm from "@/components/DocumentForm";
import { PageHeader } from "@/components/ui";

export default async function NewQuote({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const user = await requirePage("quotes");
  const ctx = await formContext("quote");
  const { customer } = await searchParams;
  if (customer) {
    const { getDb } = await import("@/lib/db");
    const c = (await (await getDb()).query<any>("SELECT id,code,full_name,phone,email,student_name FROM customers WHERE id=$1", [Number(customer)])).rows[0];
    if (c) ctx.init.customer = c;
  }
  return (<><PageHeader title="Nouveau devis" /><DocumentForm kind="quote" {...ctx} canDiscount={can(user.role, "discount")} /></>);
}
