import { getDb } from "./db";

export interface Settings {
  company_name: string; company_address: string; company_phone: string; company_email: string; company_web: string;
  tax_id: string; rib: string; bank_name: string;
  vat_rate: number; currency: string;
  quote_validity_days: number; invoice_due_days: number;
  quote_conditions: string; invoice_conditions: string;
  logo: string; // data URL (png/jpeg) or ""
}

export const DEFAULT_SETTINGS: Settings = {
  company_name: "EDUTEST",
  company_address: "Adresse à configurer, Tunis, Tunisie",
  company_phone: "+216 00 000 000",
  company_email: "contact@edutest.tn",
  company_web: "www.edutest.tn",
  tax_id: "Matricule fiscal à configurer",
  rib: "RIB à configurer",
  bank_name: "Banque à configurer",
  vat_rate: 19,
  currency: "TND",
  quote_validity_days: 30,
  invoice_due_days: 15,
  quote_conditions: "Acompte de 50 % à la commande, solde avant le début de la préparation. Les prix sont exprimés en dinars tunisiens (TND).",
  invoice_conditions: "Paiement à réception de la facture, par virement bancaire, espèces ou chèque. Toute somme non réglée à l'échéance pourra faire l'objet de pénalités de retard.",
  logo: "",
};

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const { rows } = await db.query<{ key: string; value: any }>("SELECT key,value FROM settings");
  const out: any = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out as Settings;
}
