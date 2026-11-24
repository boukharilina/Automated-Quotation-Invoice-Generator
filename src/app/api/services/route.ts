import { route } from "@/lib/api";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/util";
import { serviceSchema } from "@/lib/schemas";

export const POST = route("settings", async (req, user) => {
  const s = serviceSchema.parse(await req.json());
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>("INSERT INTO services(name,description,unit_price,active) VALUES($1,$2,$3,$4) RETURNING id", [s.name, s.description, s.unit_price, s.active]);
  await audit(db, user, "create", "service", rows[0].id, s);
  return { id: rows[0].id };
});
