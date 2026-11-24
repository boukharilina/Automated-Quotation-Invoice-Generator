import { route, pdfResponse, AppError } from "@/lib/api";
import { getPayment } from "@/lib/docs";
import { getSettings } from "@/lib/settings";
import { renderReceipt } from "@/lib/pdf";

export const GET = route<{ id: string }>("payments", async (_req, _u, { id }) => {
  const p = await getPayment(Number(id));
  if (!p) throw new AppError("Paiement introuvable.", 404);
  return pdfResponse(await renderReceipt(p, await getSettings()), `${p.receipt_number}.pdf`);
});
