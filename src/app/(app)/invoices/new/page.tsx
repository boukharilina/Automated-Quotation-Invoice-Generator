import { requirePage, can } from "@/lib/auth";
import { formContext } from "@/lib/formdata";
import { getDb } from "@/lib/db";
import DocumentForm from "@/components/DocumentForm";
import { PageHeader } from "@/components/ui";

export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const user = await requirePage("invoices");
  const ctx = await formContext("invoice");
  const { customer } = await searchParams;
  if (customer) {
    const c = (await (await getDb()).query<any>("SELECT id,code,full_name,phone,email,student_name FROM customers WHERE id=$1", [Number(customer)])).rows[0];
    if (c) ctx.init.customer = c;
  }
  return (<><PageHeader title="Nouvelle facture" subtitle="Pour facturer un devis accepté, utilisez « Convertir en facture » depuis le devis." /><DocumentForm kind="invoice" {...ctx} canDiscount={can(user.role, "discount")} /></>);
}
