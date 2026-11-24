import bcrypt from "bcryptjs";
import { route, AppError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/util";
import { userSchema } from "@/lib/schemas";

export const PUT = route<{ id: string }>("users", async (req, user, { id }) => {
  const u = userSchema.parse(await req.json());
  const uid = Number(id);
  const db = await getDb();
  if (uid === user.id && (u.role !== "admin" || !u.active)) throw new AppError("Vous ne pouvez pas retirer vos propres droits d'administrateur.", 409);
  const before = (await db.query<any>("SELECT * FROM users WHERE id=$1", [uid])).rows[0];
  if (!before) throw new AppError("Utilisateur introuvable.", 404);
  await db.query("UPDATE users SET name=$1,email=$2,role=$3,active=$4 WHERE id=$5", [u.name, u.email, u.role, u.active, uid]);
  if (u.password) await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [await bcrypt.hash(u.password, 10), uid]);
  await audit(db, user, "update", "user", uid, { email: u.email, role: { from: before.role, to: u.role }, active: u.active, password_changed: !!u.password });
  return { ok: true };
});
