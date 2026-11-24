import { route, pdfResponse, AppError } from "@/lib/api";
import { getDoc } from "@/lib/docs";
import { getSettings } from "@/lib/settings";
import { renderDocument } from "@/lib/pdf";

export const GET = route<{ id: string }>("quotes", async (_req, _u, { id }) => {
  const d = await getDoc("quote", Number(id));
  if (!d) throw new AppError("Devis introuvable.", 404);
  return pdfResponse(await renderDocument("quote", d, await getSettings()), `${d.number}.pdf`);
});
