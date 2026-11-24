import { route, AppError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/util";
import { serviceSchema } from "@/lib/schemas";

export const PUT = route<{ id: string }>("settings", async (req, user, { id }) => {
  const s = serviceSchema.parse(await req.json());
  const db = await getDb();
  const before = (await db.query<any>("SELECT * FROM services WHERE id=$1", [Number(id)])).rows[0];
  if (!before) throw new AppError("Service introuvable.", 404);
  await db.query("UPDATE services SET name=$1,description=$2,unit_price=$3,active=$4 WHERE id=$5", [s.name, s.description, s.unit_price, s.active, Number(id)]);
  await audit(db, user, "update", "service", id, { before: { name: before.name, unit_price: before.unit_price, active: before.active }, after: s });
  return { ok: true };
});
