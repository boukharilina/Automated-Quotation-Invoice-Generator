import { z } from "zod";

export const customerSchema = z.object({
  full_name: z.string().trim().min(2, "Nom complet requis").max(200),
  phone: z.string().trim().max(40).default(""),
  email: z.union([z.literal(""), z.string().trim().email("E-mail invalide")]).default(""),
  address: z.string().trim().max(500).default(""),
  cin_passport: z.string().trim().max(50).default(""),
  student_name: z.string().trim().max(200).default(""),
});
