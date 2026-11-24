import { route } from "@/lib/api";
import { updateDoc } from "@/lib/docs";

export const PUT = route<{ id: string }>("quotes", async (req, user, { id }) => updateDoc("quote", user, Number(id), await req.json()));
