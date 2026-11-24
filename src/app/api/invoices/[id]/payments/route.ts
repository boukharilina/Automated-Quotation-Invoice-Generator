import { route } from "@/lib/api";
import { addPayment } from "@/lib/docs";

export const POST = route<{ id: string }>("payments", async (req, user, { id }) => addPayment(user, Number(id), await req.json()));
