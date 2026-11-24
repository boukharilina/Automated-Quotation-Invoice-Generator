import { z } from "zod";
import { route } from "@/lib/api";
import { setInvoiceStatus } from "@/lib/docs";

export const POST = route<{ id: string }>("invoices", async (req, user, { id }) => {
  const { status } = z.object({ status: z.enum(["issued", "cancelled"]) }).parse(await req.json());
  return setInvoiceStatus(user, Number(id), status);
});
