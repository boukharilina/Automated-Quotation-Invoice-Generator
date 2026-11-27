import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["pdfkit", "@electric-sql/pglite", "pg", "exceljs", "nodemailer"],
};
export default config;
