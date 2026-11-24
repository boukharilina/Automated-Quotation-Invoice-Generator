import { route } from "@/lib/api";
import { updateDoc } from "@/lib/docs";

export const PUT = route<{ id: string }>("invoices", async (req, user, { id }) => updateDoc("invoice", user, Number(id), await req.json()));
