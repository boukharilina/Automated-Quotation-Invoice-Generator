import { z } from "zod";

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(200),
  description: z.string().trim().max(500).default(""),
  unit_price: z.coerce.number().finite().min(0, "Prix positif requis"),
  active: z.boolean().default(true),
});

export const userSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(100),
  email: z.string().trim().toLowerCase().email("E-mail invalide"),
  role: z.enum(["admin", "accounting", "sales"]),
  active: z.boolean().default(true),
  password: z.string().min(8, "Mot de passe : 8 caractères minimum").max(100).optional().or(z.literal("")),
});
