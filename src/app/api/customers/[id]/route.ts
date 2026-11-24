import { route, AppError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/util";
import { customerSchema } from "@/lib/customers";

export const PUT = route<{ id: string }>("customers", async (req, user, { id }) => {
  const c = customerSchema.parse(await req.json());
  const db = await getDb();
  return db.tx(async (q) => {
    const before = (await q.query<any>("SELECT * FROM customers WHERE id=$1 FOR UPDATE", [Number(id)])).rows[0];
    if (!before) throw new AppError("Client introuvable.", 404);
    await q.query("UPDATE customers SET full_name=$1,phone=$2,email=$3,address=$4,cin_passport=$5,student_name=$6 WHERE id=$7",
      [c.full_name, c.phone, c.email, c.address, c.cin_passport, c.student_name, Number(id)]);
    await audit(q, user, "update", "customer", id, { code: before.code, before: { full_name: before.full_name, phone: before.phone, email: before.email }, after: c });
    return { ok: true };
  });
});
