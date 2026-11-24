import { getDb } from "./db";
import { getSettings } from "./settings";
import { addDays, today } from "./util";
import type { DocInit } from "@/components/DocumentForm";

/** Services + defaults shared by the new/edit pages for quotes and invoices. */
export async function formContext(kind: "quote" | "invoice") {
  const db = await getDb();
  const s = await getSettings();
  const services = (await db.query<any>("SELECT id,name,unit_price FROM services WHERE active ORDER BY id")).rows;
  const first = services[0];
  const t = today();
  const init: DocInit = {
    issue_date: t, second_date: addDays(t, kind === "quote" ? s.quote_validity_days : s.invoice_due_days),
    payment_method: "bank_transfer", notes: "", conditions: kind === "quote" ? s.quote_conditions : s.invoice_conditions, discount: 0, extra_charges: 0,
    items: first ? [{ service_id: first.id, description: first.name, quantity: 1, unit_price: first.unit_price }] : [{ service_id: null, description: "", quantity: 1, unit_price: 0 }],
  };
  return { services, vatRate: s.vat_rate, init };
}

export function initFromDoc(d: any, kind: "quote" | "invoice"): DocInit {
  return {
    id: d.id, customer: { id: d.customer_id, code: d.customer_code, full_name: d.customer_name, phone: d.customer_phone, email: d.customer_email, student_name: d.customer_student },
    issue_date: d.issue_date, second_date: kind === "quote" ? d.valid_until : d.due_date, payment_method: d.payment_method,
    notes: d.notes, conditions: d.conditions, discount: d.discount, extra_charges: d.extra_charges,
    items: d.items.map((i: any) => ({ service_id: i.service_id, description: i.description, quantity: i.quantity, unit_price: i.unit_price })),
  };
}
