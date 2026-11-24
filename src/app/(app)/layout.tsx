import { requirePage, can, ROLE_LABEL, type Perm } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import Shell, { type NavItem } from "@/components/Shell";

export const dynamic = "force-dynamic";

const ALL: (NavItem & { perm: Perm })[] = [
  { href: "/", label: "Tableau de bord", icon: "dashboard", perm: "dashboard" },
  { href: "/customers", label: "Clients", icon: "customers", perm: "customers" },
  { href: "/quotes", label: "Devis", icon: "quotes", perm: "quotes" },
  { href: "/invoices", label: "Factures", icon: "invoices", perm: "invoices" },
  { href: "/payments", label: "Paiements", icon: "payments", perm: "payments" },
  { href: "/archive", label: "Archives", icon: "archive", perm: "archive" },
  { href: "/audit", label: "Journal d'audit", icon: "audit", perm: "audit" },
  { href: "/settings", label: "Paramètres", icon: "settings", perm: "settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage();
  const s = await getSettings();
  const nav = ALL.filter((n) => can(user.role, n.perm)).map(({ perm, ...n }) => n);
  return <Shell nav={nav} user={{ name: user.name, role: ROLE_LABEL[user.role] }} logo={s.logo} company={s.company_name}>{children}</Shell>;
}
