import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["pdfkit", "@electric-sql/pglite", "pg", "exceljs"],
};
export default config;
