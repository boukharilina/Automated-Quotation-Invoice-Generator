import { route } from "@/lib/api";
import { emailDoc } from "@/lib/mail";

export const POST = route<{ id: string }>("invoices", async (_req, user, { id }) => emailDoc("invoice", user, Number(id)));
