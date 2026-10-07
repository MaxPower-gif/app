import { ROLE_LABEL } from "@/lib/api";

const STYLES = {
  admin: "bg-red-500/10 text-red-500 border-red-500/20",
  gerente: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  cajero: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  pendiente: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export const RoleBadge = ({ role, testId }) => (
  <span data-testid={testId || "role-badge"} className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${STYLES[role]}`}>
    {ROLE_LABEL[role]}
  </span>
);

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between rise">
    <div>
      <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight" data-testid="page-title">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </div>
);

export const Panel = ({ title, action, children, className = "", testId }) => (
  <section data-testid={testId} className={`rounded-lg border border-border bg-card p-4 sm:p-5 rise ${className}`}>
    {(title || action) && (
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">{title}</h2>
        {action}
      </div>
    )}
    {children}
  </section>
);
