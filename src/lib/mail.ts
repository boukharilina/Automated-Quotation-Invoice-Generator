import nodemailer from "nodemailer";
import { z } from "zod";
import { AppError } from "./api";
import type { SessionUser } from "./auth";
import { getDb } from "./db";
import { getDoc, type Kind } from "./docs";
import { fmt } from "./money";
import { renderDocument } from "./pdf";
import { getSettings } from "./settings";
import { audit, fmtDate } from "./util";

/** Envoie le devis ou la facture (PDF joint) à l'adresse e-mail enregistrée sur la fiche client. */
export async function emailDoc(kind: Kind, user: SessionUser, id: number) {
  const isQ = kind === "quote";
  const d = await getDoc(kind, id);
  if (!d) throw new AppError(isQ ? "Devis introuvable." : "Facture introuvable.", 404);
  if (["draft", "cancelled"].includes(d.status)) throw new AppError("Un document brouillon ou annulé ne peut pas être envoyé.", 409);
  const to = z.string().email().safeParse(String(d.customer_email ?? "").trim());
  if (!to.success) throw new AppError("Ce client n'a pas d'adresse e-mail valide. Ajoutez-la sur sa fiche.");

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) throw new AppError("Envoi d'e-mail non configuré (SMTP_HOST, SMTP_USER, SMTP_PASSWORD).", 503);

  const s = await getSettings();
  const label = isQ ? "devis" : "facture";
  const pdf = await renderDocument(kind, d, s);
  const port = Number(SMTP_PORT || 587);
  const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD }, connectionTimeout: 15_000 });
  try {
    await transport.sendMail({
      from: { name: s.company_name, address: SMTP_FROM || SMTP_USER },
      replyTo: z.string().email().safeParse(s.company_email).success ? s.company_email : undefined,
      to: to.data,
      subject: `${s.company_name} – ${isQ ? "Devis" : "Facture"} ${d.number}`,
      text: [
        `Bonjour ${d.customer_name},`,
        "",
        `Veuillez trouver ci-joint ${isQ ? "notre devis" : "votre facture"} ${d.number} d'un montant de ${fmt(d.total_ttc)} TTC.`,
        isQ ? `Ce devis est valable jusqu'au ${fmtDate(d.valid_until)}.` : `Date d'échéance : ${fmtDate(d.due_date)}.`,
        "",
        "Cordialement,",
        s.company_name,
        s.company_phone,
      ].join("\n"),
      attachments: [{ filename: `${d.number}.pdf`, content: pdf, contentType: "application/pdf" }],
    });
  } catch (e) {
    console.error(e);
    throw new AppError(`L'envoi de l'e-mail (${label}) a échoué. Vérifiez la configuration SMTP.`, 502);
  }
  await audit(await getDb(), user, "email", kind, id, { number: d.number, to: to.data });
  return { to: to.data };
}
