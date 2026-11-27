import { route } from "@/lib/api";
import { exportList } from "@/lib/listExport";

export const GET = route("quotes", async (req) => exportList("quote", new URL(req.url).searchParams));
