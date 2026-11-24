import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getUser, can, type Perm, type SessionUser } from "./auth";

export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler: authentication, permission check, validation + error mapping (French messages). */
export function route<P = Record<string, string>>(
  perm: Perm | null,
  fn: (req: Request, user: SessionUser, params: P) => Promise<Response | object>,
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const user = await getUser();
      if (!user) throw new AppError("Session expirée, veuillez vous reconnecter.", 401);
      if (perm && !can(user.role, perm)) throw new AppError("Accès refusé : droits insuffisants.", 403);
      const out = await fn(req, user, await ctx.params);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) { return fail(e); }
  };
}

export function fail(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) {
    const msg = e.issues.map((i) => (i.path.length ? `${i.path.join(".")} : ` : "") + i.message).join(" ; ");
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const code = (e as any)?.code;
  if (code === "23505") return NextResponse.json({ error: "Cet enregistrement existe déjà (doublon)." }, { status: 409 });
  console.error(e);
  return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
}

export const num = (v: unknown) => Number(v);
export const pdfResponse = (buf: Buffer, filename: string) =>
  new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"` } });
