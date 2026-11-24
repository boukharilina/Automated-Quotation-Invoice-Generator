import { route } from "@/lib/api";
import { getDb } from "@/lib/db";
import { audit, nextNumber } from "@/lib/util";
import { customerSchema } from "@/lib/customers";

export const GET = route("customers", async (req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const db = await getDb();
  const like = `%${q}%`;
  const { rows } = await db.query(
    `SELECT id,code,full_name,phone,email,student_name FROM customers
     WHERE $1 = '' OR full_name ILIKE $2 OR code ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2 OR student_name ILIKE $2 OR cin_passport ILIKE $2
     ORDER BY full_name LIMIT 20`, [q, like]);
  return rows;
});

export const POST = route("customers", async (req, user) => {
  const c = customerSchema.parse(await req.json());
  const db = await getDb();
  return db.tx(async (q) => {
    const code = await nextNumber(q, "CLI", 0);
    const { rows } = await q.query<{ id: number }>(
      "INSERT INTO customers(code,full_name,phone,email,address,cin_passport,student_name) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [code, c.full_name, c.phone, c.email, c.address, c.cin_passport, c.student_name]);
    await audit(q, user, "create", "customer", rows[0].id, { code, name: c.full_name });
    return { id: rows[0].id, code, full_name: c.full_name, phone: c.phone, email: c.email, student_name: c.student_name };
  });
});
