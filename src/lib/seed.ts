import bcrypt from "bcryptjs";
import type { DB } from "./db";
import { DEFAULT_SETTINGS } from "./settings";

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
  const s = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM services");
  if (s.rows[0].n === 0) {
    await db.query("INSERT INTO services(name,description,unit_price) VALUES($1,$2,3500),($3,$4,0)", [
      "Frais de préparation aux tests – TOEFL + SAT", "Préparation aux examens TOEFL et SAT",
      "Frais de dossier administratif / candidature", "Montant configurable selon le dossier",
    ]);
  }
}
