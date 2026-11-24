import { route } from "@/lib/api";
import { createDoc } from "@/lib/docs";

export const POST = route("invoices", async (req, user) => createDoc("invoice", user, await req.json()));
