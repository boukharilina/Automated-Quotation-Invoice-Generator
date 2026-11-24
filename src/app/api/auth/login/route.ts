import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { audit } from "@/lib/util";
import { fail, AppError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const { email, password } = z.object({ email: z.string().trim().toLowerCase().email("E-mail invalide"), password: z.string().min(1, "Mot de passe requis") }).parse(await req.json());
    const db = await getDb();
    // Persistent throttle (works across serverless instances): 5 failures -> 15 min lock.
    const lock = (await db.query<any>("SELECT 1 FROM login_attempts WHERE email=$1 AND locked_until > now()", [email])).rows[0];
    if (lock) throw new AppError("Trop de tentatives. Réessayez dans quelques minutes.", 429);
    const u = (await db.query<any>("SELECT * FROM users WHERE email=$1 AND active", [email])).rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash))) {
      await db.query(
        `INSERT INTO login_attempts(email,n) VALUES($1,1)
         ON CONFLICT (email) DO UPDATE SET n = CASE WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until <= now() THEN 1 ELSE login_attempts.n + 1 END,
           locked_until = CASE WHEN (CASE WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until <= now() THEN 1 ELSE login_attempts.n + 1 END) >= 5 THEN now() + interval '15 minutes' ELSE NULL END`, [email]);
      throw new AppError("E-mail ou mot de passe incorrect.", 401);
    }
    await db.query("DELETE FROM login_attempts WHERE email=$1", [email]);
    await createSession(u.id);
    await audit(db, { id: u.id, name: u.name }, "login", "user", u.id);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
