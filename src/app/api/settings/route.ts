import { z } from "zod";
import { route } from "@/lib/api";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/util";
import { getSettings } from "@/lib/settings";

const schema = z.object({
  company_name: z.string().trim().min(1).max(100),
  company_address: z.string().trim().max(300),
  company_phone: z.string().trim().max(60),
  company_email: z.string().trim().max(120),
  company_web: z.string().trim().max(120),
  tax_id: z.string().trim().max(100),
  rib: z.string().trim().max(100),
  bank_name: z.string().trim().max(100),
  vat_rate: z.coerce.number().min(0, "TVA entre 0 et 100").max(100, "TVA entre 0 et 100"),
  quote_validity_days: z.coerce.number().int().min(1).max(365),
  invoice_due_days: z.coerce.number().int().min(0).max(365),
  quote_conditions: z.string().max(4000),
  invoice_conditions: z.string().max(4000),
  logo: z.string().max(900_000, "Logo trop volumineux (max ~600 Ko)").refine((v) => v === "" || /^data:image\/(png|jpeg);base64,/.test(v), "Logo : PNG ou JPEG uniquement"),
});

export const PUT = route("settings", async (req, user) => {
  const input = schema.parse(await req.json());
  const db = await getDb();
  const before = await getSettings();
  await db.tx(async (q) => {
    for (const [k, v] of Object.entries(input))
      await q.query("INSERT INTO settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [k, JSON.stringify(v)]);
    const changed = Object.fromEntries(Object.entries(input).filter(([k, v]) => (before as any)[k] !== v && k !== "logo").map(([k, v]) => [k, { from: (before as any)[k], to: v }]));
    await audit(q, user, "update", "settings", "global", { changed, logo_changed: before.logo !== input.logo });
  });
  return { ok: true };
});
