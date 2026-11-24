import Link from "next/link";
import type { ReactNode } from "react";
import clsx from "clsx";
import { INVOICE_STATUS, QUOTE_STATUS } from "@/lib/util";

const TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700", sent: "bg-blue-100 text-blue-800", accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800", expired: "bg-amber-100 text-amber-800", converted: "bg-violet-100 text-violet-800",
  issued: "bg-blue-100 text-blue-800", partially_paid: "bg-amber-100 text-amber-800", paid: "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-100 text-red-800", cancelled: "bg-slate-200 text-slate-600 line-through",
};
export function Badge({ status, kind }: { status: string; kind: "quote" | "invoice" }) {
  const label = (kind === "quote" ? QUOTE_STATUS : INVOICE_STATUS)[status] ?? status;
  return <span className={clsx("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[status])}>{label}</span>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-brand">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "red" | "green" | "orange" }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={clsx("mt-1 text-xl font-bold tabular-nums", tone === "red" ? "text-red-700" : tone === "green" ? "text-emerald-700" : tone === "orange" ? "text-accent" : "text-brand")}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Table({ head, children, empty }: { head: (string | { t: string; right?: boolean })[]; children: ReactNode; empty?: string }) {
  const rows = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>{head.map((h, i) => { const o = typeof h === "string" ? { t: h } : h; return <th key={i} className={clsx("th", (o as any).right && "text-right")}>{o.t}</th>; })}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {rows === 0 && <p className="p-6 text-center text-sm text-slate-500">{empty ?? "Aucun résultat."}</p>}
    </div>
  );
}

export const A = ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
  <Link href={href} className={clsx("font-medium text-brand hover:underline", className)}>{children}</Link>
);

export const Right = ({ children }: { children: ReactNode }) => <td className="td text-right tabular-nums">{children}</td>;
