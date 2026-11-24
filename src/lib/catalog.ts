/** Catalogue fermé des services. Prix par défaut exprimés en TTC (TND). */
export const SERVICE_CATALOG = [
  { name: "Frais de préparation TOEFL et SAT", description: "Préparation aux examens TOEFL et SAT", ttc: 3500 },
  { name: "Frais de préparation TOEFL", description: "Préparation à l'examen TOEFL", ttc: 3500 },
  { name: "Frais de préparation SAT + IELTS", description: "Préparation aux examens SAT et IELTS", ttc: 3500 },
  { name: "Frais de préparation GED", description: "Préparation à l'examen GED", ttc: 3500 },
  { name: "Frais de préparation GRE", description: "Préparation à l'examen GRE", ttc: 3500 },
  { name: "Frais de dossier", description: "Frais d'ouverture et de traitement du dossier", ttc: 1000 },
  { name: "Frais d'accompagnement et applications aux universités", description: "Accompagnement et candidatures aux universités", ttc: 0 },
] as const;

export const SERVICE_NAMES = SERVICE_CATALOG.map((s) => s.name) as unknown as [string, ...string[]];
