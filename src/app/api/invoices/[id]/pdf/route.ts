import { route, pdfResponse, AppError } from "@/lib/api";
import { getDoc } from "@/lib/docs";
import { getSettings } from "@/lib/settings";
import { renderDocument } from "@/lib/pdf";

export const GET = route<{ id: string }>("invoices", async (_req, _u, { id }) => {
  const d = await getDoc("invoice", Number(id));
  if (!d) throw new AppError("Facture introuvable.", 404);
  return pdfResponse(await renderDocument("invoice", d, await getSettings()), `${d.number}.pdf`);
});
