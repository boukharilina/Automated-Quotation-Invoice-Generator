import { route } from "@/lib/api";
import { convertQuote } from "@/lib/docs";

// Needs both rights: reads a quote and creates an invoice.
export const POST = route<{ id: string }>("invoices", async (_req, user, { id }) => convertQuote(user, Number(id)));
