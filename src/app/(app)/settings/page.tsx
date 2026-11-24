import { requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { CompanyForm, ServicesEditor, UsersEditor } from "@/components/SettingsForms";
import { PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const me = await requirePage("settings");
  const db = await getDb();
  const [s, services, users] = await Promise.all([
    getSettings(),
    db.query<any>("SELECT * FROM services ORDER BY id").then((r) => r.rows),
    db.query<any>("SELECT id,name,email,role,active FROM users ORDER BY id").then((r) => r.rows),
  ]);
  return (
    <>
      <PageHeader title="Paramètres" subtitle="Réservé aux administrateurs." />
      <h2 className="mb-2 text-lg font-semibold text-brand">Société, TVA et conditions</h2>
      <CompanyForm s={s} />
      <h2 className="mb-2 mt-8 text-lg font-semibold text-brand">Catalogue de services</h2>
      <ServicesEditor services={services} vatRate={Number(s.vat_rate)} />
      <h2 className="mb-2 mt-8 text-lg font-semibold text-brand">Utilisateurs et rôles</h2>
      <UsersEditor users={users} meId={me.id} />
    </>
  );
}
