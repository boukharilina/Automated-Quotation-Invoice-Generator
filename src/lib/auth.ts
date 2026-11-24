import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { getDb } from "./db";

export type Role = "admin" | "accounting" | "sales";
export type Perm = "dashboard" | "customers" | "quotes" | "invoices" | "payments" | "discount" | "settings" | "users" | "audit" | "export" | "archive";

export interface SessionUser { id: number; email: string; name: string; role: Role }

const ALL: Perm[] = ["dashboard", "customers", "quotes", "invoices", "payments", "discount", "settings", "users", "audit", "export", "archive"];
const MATRIX: Record<Role, Perm[]> = {
  admin: ALL,
  accounting: ["dashboard", "customers", "quotes", "invoices", "payments", "discount", "export", "archive"],
  sales: ["customers", "quotes", "archive"],
};
export const can = (role: Role, p: Perm) => MATRIX[role].includes(p);
export const ROLE_LABEL: Record<Role, string> = { admin: "Administrateur", accounting: "Comptabilité", sales: "Équipe commerciale" };

const COOKIE = "edutest_session";
const MAX_AGE = 60 * 60 * 12;
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET manquant");
  return new TextEncoder().encode(s || "dev-only-insecure-secret-change-me");
};

export async function createSession(userId: number) {
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(String(userId))
    .setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }

/** Current user, re-validated against the database on each request (deactivation / role changes apply immediately). */
export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const db = await getDb();
    const { rows } = await db.query<SessionUser>("SELECT id,email,name,role FROM users WHERE id=$1 AND active", [Number(payload.sub)]);
    return rows[0] ?? null;
  } catch { return null; }
}

/** For pages: redirects to /login, or to home when the role lacks the permission. */
export async function requirePage(perm?: Perm): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  if (perm && !can(u.role, perm)) redirect(can(u.role, "dashboard") ? "/" : "/quotes");
  return u;
}
