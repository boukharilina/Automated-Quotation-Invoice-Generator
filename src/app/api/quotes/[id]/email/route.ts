import { route } from "@/lib/api";
import { emailDoc } from "@/lib/mail";

export const POST = route<{ id: string }>("quotes", async (_req, user, { id }) => emailDoc("quote", user, Number(id)));
