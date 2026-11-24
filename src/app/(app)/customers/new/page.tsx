import { requirePage } from "@/lib/auth";
import CustomerForm from "@/components/CustomerForm";
import { PageHeader } from "@/components/ui";

export default async function NewCustomer() {
  await requirePage("customers");
  return (<><PageHeader title="Nouveau client" /><CustomerForm /></>);
}
