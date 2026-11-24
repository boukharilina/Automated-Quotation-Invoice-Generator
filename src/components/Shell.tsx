"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Archive, BarChart3, CreditCard, FileText, History, Menu, LogOut, Receipt, Settings, Users, X } from "lucide-react";
import { api } from "./client";

const ICONS: Record<string, any> = { dashboard: BarChart3, customers: Users, quotes: FileText, invoices: Receipt, payments: CreditCard, archive: Archive, audit: History, settings: Settings };

export interface NavItem { href: string; label: string; icon: string }

export default function Shell({ nav, user, logo, company, children }: { nav: NavItem[]; user: { name: string; role: string }; logo: string; company: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const router = useRouter();
  const logout = async () => { await api("POST", "/api/auth/logout"); router.push("/login"); router.refresh(); };
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));

  const side = (
    <div className="flex h-full flex-col bg-brand text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        {logo ? <img src={logo} alt={company} className="max-h-10 max-w-[140px] rounded bg-white p-1" /> : (
          <><span className="h-9 w-2 rounded bg-accent" /><span className="text-xl font-extrabold tracking-wide">{company}</span></>
        )}
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((n) => { const I = ICONS[n.icon]; return (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
            className={clsx("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition", active(n.href) ? "bg-white/15 text-white" : "text-blue-100 hover:bg-white/10")}>
            <I size={18} /> {n.label}
          </Link>); })}
      </nav>
      <div className="border-t border-white/10 p-4 text-sm">
        <div className="font-semibold">{user.name}</div>
        <div className="mb-3 text-xs text-blue-200">{user.role}</div>
        <button onClick={logout} className="flex items-center gap-2 text-blue-100 hover:text-white"><LogOut size={16} /> Déconnexion</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print hidden w-64 shrink-0 lg:block"><div className="fixed inset-y-0 w-64">{side}</div></aside>
      <header className="no-print sticky top-0 z-30 flex items-center justify-between bg-brand px-4 py-3 text-white lg:hidden">
        <span className="text-lg font-extrabold tracking-wide">{company}</span>
        <button onClick={() => setOpen(true)} aria-label="Menu"><Menu /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72">{side}</div>
          <button className="absolute right-4 top-4 text-white" onClick={() => setOpen(false)} aria-label="Fermer"><X /></button>
        </div>
      )}
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
