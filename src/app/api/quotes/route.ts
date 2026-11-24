import { route } from "@/lib/api";
import { createDoc } from "@/lib/docs";

export const POST = route("quotes", async (req, user) => createDoc("quote", user, await req.json()));
