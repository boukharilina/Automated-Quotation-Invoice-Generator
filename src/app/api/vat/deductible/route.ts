import { route, AppError } from "@/lib/api";
import { deleteDeductibleMonth, importDeductible, parseDeductible } from "@/lib/vat";

/** Import des achats (TVA déductible) depuis un fichier Excel. */
export const POST = route("vat", async (req, user) => {
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || !file.size) throw new AppError("Choisissez un fichier Excel.");
  if (file.size > 2_000_000) throw new AppError("Fichier trop volumineux (2 Mo au maximum).");
  return importDeductible(user, await parseDeductible(await file.arrayBuffer()));
});

export const DELETE = route("vat", async (req, user) => {
  await deleteDeductibleMonth(user, new URL(req.url).searchParams.get("month") ?? "");
  return { ok: true };
});
