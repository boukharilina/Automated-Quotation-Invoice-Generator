import bcrypt from "bcryptjs";
import { route, AppError } from "@/lib/api";
import { userSchema } from "@/lib/schemas";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/util";

export const POST = route("users", async (req, user) => {
  const u = userSchema.parse(await req.json());
  if (!u.password) throw new AppError("Mot de passe requis");
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>("INSERT INTO users(email,name,password_hash,role,active) VALUES($1,$2,$3,$4,$5) RETURNING id", [u.email, u.name, await bcrypt.hash(u.password, 10), u.role, u.active]);
  await audit(db, user, "create", "user", rows[0].id, { email: u.email, role: u.role });
  return { id: rows[0].id };
});
