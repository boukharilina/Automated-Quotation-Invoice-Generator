import { route } from "@/lib/api";
import { exportList } from "@/lib/listExport";

export const GET = route("invoices", async (req) => exportList("invoice", new URL(req.url).searchParams));
