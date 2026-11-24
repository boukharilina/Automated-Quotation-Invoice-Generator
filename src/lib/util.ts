import type { Q } from "./db";

export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Tunis" });
export function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const s = typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  const [y, m, day] = s.split("-"); return `${day}/${m}/${y}`;
};

export const QUOTE_STATUS: Record<string, string> = { draft: "Brouillon", sent: "Envoyé", accepted: "Accepté", rejected: "Refusé", expired: "Expiré", converted: "Converti en facture" };
export const INVOICE_STATUS: Record<string, string> = { draft: "Brouillon", issued: "Émise", partially_paid: "Partiellement payée", paid: "Payée", overdue: "En retard", cancelled: "Annulée" };
export const METHODS: Record<string, string> = { bank_transfer: "Virement bancaire", cash: "Espèces", check: "Chèque", other: "Autre" };

/** Atomic, gap-free sequential numbering: DEV-2026-0001. Unique index on `number` is the second safety net. */
export async function nextNumber(q: Q, kind: "DEV" | "FAC" | "REC" | "CLI", year: number): Promise<string> {
  const y = kind === "CLI" ? 0 : year;
  const { rows } = await q.query<{ last: number }>(
    "INSERT INTO counters(kind,year,last) VALUES($1,$2,1) ON CONFLICT (kind,year) DO UPDATE SET last = counters.last + 1 RETURNING last", [kind, y]);
  const n = String(rows[0].last).padStart(4, "0");
  return kind === "CLI" ? `CLI-${n}` : `${kind}-${year}-${n}`;
}

/** Automatic status transitions that depend on the calendar. */
export async function refreshStatuses(q: Q) {
  const t = today();
  await q.query("UPDATE quotes SET status='expired', updated_at=now() WHERE status IN ('draft','sent') AND valid_until < $1", [t]);
  await q.query("UPDATE invoices SET status='overdue', updated_at=now() WHERE status IN ('issued','partially_paid') AND due_date < $1", [t]);
}

export async function audit(q: Q, user: { id: number; name: string } | null, action: string, entity: string, entityId: string | number, details: object = {}) {
  await q.query("INSERT INTO audit_log(user_id,user_name,action,entity,entity_id,details) VALUES($1,$2,$3,$4,$5,$6::jsonb)",
    [user?.id ?? null, user?.name ?? "système", action, entity, String(entityId), JSON.stringify(details)]);
}
