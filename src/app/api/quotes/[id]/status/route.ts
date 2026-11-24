import { z } from "zod";
import { route } from "@/lib/api";
import { setQuoteStatus } from "@/lib/docs";

export const POST = route<{ id: string }>("quotes", async (req, user, { id }) => {
  const { status } = z.object({ status: z.enum(["draft", "sent", "accepted", "rejected"]) }).parse(await req.json());
  return setQuoteStatus(user, Number(id), status);
});
