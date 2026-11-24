import bcrypt from "bcryptjs";
import type { DB } from "./db";
import { DEFAULT_SETTINGS } from "./settings";
import { SERVICE_CATALOG } from "./catalog";
import { htFromTtc } from "./money";

export async function seed(db: DB) {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await db.query("INSERT INTO settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT (key) DO NOTHING", [k, JSON.stringify(v)]);
  }
  const u = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM users");
  if (u.rows[0].n === 0) {
    const email = (process.env.ADMIN_EMAIL || "admin@edutest.tn").toLowerCase();
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "Edutest2026!", 10);
    await db.query("INSERT INTO users(email,name,password_hash,role) VALUES($1,'Administrateur',$2,'admin')", [email, hash]);
  }
  // Catalogue fermé : les prix par défaut sont saisis en TTC et stockés en HT.
  const vr = await db.query<{ value: any }>("SELECT value FROM settings WHERE key='vat_rate'");
  const vat = Number(vr.rows[0]?.value ?? DEFAULT_SETTINGS.vat_rate);
  const [first, dossier] = [SERVICE_CATALOG[0], SERVICE_CATALOG[5]];
  // Anciennes lignes par défaut (3500 était saisi en HT à tort) -> renommées et corrigées.
  await db.query("UPDATE services SET name=$1, description=$2, unit_price=$3 WHERE name='Frais de préparation aux tests – TOEFL + SAT' AND unit_price=3500", [first.name, first.description, htFromTtc(first.ttc, vat)]);
  await db.query("UPDATE services SET name=$1, description=$2, unit_price=$3 WHERE name='Frais de dossier administratif / candidature' AND unit_price=0", [dossier.name, dossier.description, htFromTtc(dossier.ttc, vat)]);
  for (const c of SERVICE_CATALOG) {
    const e = await db.query("SELECT 1 FROM services WHERE name=$1", [c.name]);
    if (e.rowCount === 0) await db.query("INSERT INTO services(name,description,unit_price) VALUES($1,$2,$3)", [c.name, c.description, htFromTtc(c.ttc, vat)]);
  }
}
