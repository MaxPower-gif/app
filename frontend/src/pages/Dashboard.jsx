import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DollarSign, ShoppingBag, Receipt, AlertTriangle, Wallet, Package, TrendingUp, TrendingDown } from "lucide-react";
import { api, money, fdate, PAY_LABEL } from "@/lib/api";
import { PageHeader, Panel } from "@/components/RoleBadge";
import { ReportButton } from "@/components/ReportButton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLORS = ["#2563EB", "#10B981", "#EAB308", "#EF4444", "#8B5CF6", "#06B6D4", "#F97316"];
const tip = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 } };

const Delta = ({ now, prev }) => {
  if (!prev) return <span className="text-xs text-muted-foreground">sin datos de ayer</span>;
  const pct = ((now - prev) / prev) * 100;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? "text-emerald-500" : "text-red-500"}`}><Icon className="h-3 w-3" />{pct.toFixed(1)}% vs ayer</span>;
};

const Kpi = ({ icon: Icon, label, value, foot, accent, testId, delay }) => (
  <div data-testid={testId} style={{ animationDelay: `${delay}ms` }} className="rise rounded-lg border border-border bg-card p-5 relative overflow-hidden">
    <div className="absolute left-0 top-0 h-full w-1" style={{ background: accent }} />
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <Icon className="h-5 w-5" style={{ color: accent }} />
    </div>
    <div className="font-display mt-3 text-3xl lg:text-4xl font-extrabold tracking-tight tabular-nums" data-testid={`${testId}-value`}>{value}</div>
    <div className="mt-1">{foot}</div>
  </div>
);

export default function Dashboard() {
  const [days, setDays] = useState("14");
  const [d, setD] = useState(null);
  useEffect(() => {
    api.get("/dashboard", { params: { days, tz: new Date().getTimezoneOffset() } }).then((r) => setD(r.data));
  }, [days]);
  if (!d) return <div className="text-muted-foreground" data-testid="dashboard-loading">Cargando métricas…</div>;
  const k = d.kpis;
  return (
    <div data-testid="dashboard-page">
      <PageHeader title="Panel Ejecutivo" subtitle="Ingresos, ventas, caja y alertas de tu supermercado">
        <Tabs value={days} onValueChange={setDays}>
          <TabsList>
            <TabsTrigger value="7" data-testid="range-7">7 días</TabsTrigger>
            <TabsTrigger value="14" data-testid="range-14">14 días</TabsTrigger>
            <TabsTrigger value="30" data-testid="range-30">30 días</TabsTrigger>
          </TabsList>
        </Tabs>
        <ReportButton />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi delay={0} testId="kpi-ingresos" icon={DollarSign} label="Ingresos hoy" value={money(k.ingresos_hoy)} accent="#2563EB" foot={<Delta now={k.ingresos_hoy} prev={k.ingresos_ayer} />} />
        <Kpi delay={60} testId="kpi-ventas" icon={ShoppingBag} label="Ventas hoy" value={k.ventas_hoy} accent="#10B981" foot={<Delta now={k.ventas_hoy} prev={k.ventas_ayer} />} />
        <Kpi delay={120} testId="kpi-ticket" icon={Receipt} label="Ticket promedio" value={money(k.ticket_hoy)} accent="#EAB308" foot={<Delta now={k.ticket_hoy} prev={k.ticket_ayer} />} />
        <Kpi delay={180} testId="kpi-alertas" icon={AlertTriangle} label="Alertas activas" value={k.alertas_activas} accent="#EF4444"
          foot={<Link to="/alertas" className="text-xs text-primary hover:underline" data-testid="kpi-alertas-link">{k.stock_bajo} de stock bajo · ver todas</Link>} />
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title={`Ingresos últimos ${days} días`} className="lg:col-span-2" testId="chart-daily"
          action={<span className="font-display text-xl font-bold">{money(k.ingresos_periodo)}</span>}>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={d.daily}>
                <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.45} /><stop offset="100%" stopColor="#2563EB" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="fecha" tickFormatter={(v) => v.slice(5)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v}`} width={60} />
                <Tooltip {...tip} formatter={(v, n) => (n === "ingresos" ? money(v) : v)} />
                <Area type="monotone" dataKey="ingresos" stroke="#2563EB" strokeWidth={2.5} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Métodos de pago" testId="chart-payments">
          <div className="h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={d.payments} dataKey="total" nameKey="metodo" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {d.payments.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip {...tip} formatter={(v, n) => [money(v), PAY_LABEL[n]]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {d.payments.map((p, i) => (
              <div key={p.metodo} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i] }} />{PAY_LABEL[p.metodo]}</span>
                <span className="font-mono-num">{money(p.total)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Ventas por hora (hoy)" testId="chart-hourly">
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={d.hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="hora" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} width={45} />
                <Tooltip {...tip} formatter={(v) => money(v)} />
                <Bar dataKey="ingresos" fill="#10B981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Ingresos por categoría" testId="chart-categories">
          <div className="space-y-3">
            {d.categories.map((c, i) => {
              const max = d.categories[0]?.total || 1;
              return (
                <div key={c.categoria}>
                  <div className="flex justify-between text-sm"><span>{c.categoria}</span><span className="font-mono-num text-muted-foreground">{money(c.total)}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${(c.total / max) * 100}%`, background: COLORS[i % COLORS.length] }} /></div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Productos más vendidos" testId="top-products">
          <div className="divide-y divide-border">
            {d.top_products.map((p, i) => (
              <div key={p.nombre} className="flex items-center gap-3 py-2.5">
                <span className="font-display w-6 text-xl font-black text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{p.nombre}</div><div className="text-xs text-muted-foreground">{p.qty} unidades</div></div>
                <span className="font-mono-num text-sm">{money(p.total)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Estado operativo" testId="ops-status">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-secondary p-3"><Wallet className="h-4 w-4 text-yellow-500" /><div className="font-display mt-2 text-2xl font-bold" data-testid="ops-cajas-abiertas">{k.cajas_abiertas}</div><div className="text-xs text-muted-foreground">Cajas abiertas</div></div>
            <div className="rounded-md bg-secondary p-3"><Package className="h-4 w-4 text-primary" /><div className="font-display mt-2 text-2xl font-bold">{money(k.valor_inventario)}</div><div className="text-xs text-muted-foreground">Valor inventario (costo)</div></div>
            <div className="col-span-2 rounded-md bg-secondary p-3"><div className="text-xs text-muted-foreground">Ventas del periodo</div><div className="font-display text-2xl font-bold">{k.ventas_periodo} tickets</div></div>
          </div>
        </Panel>
        <Panel title="Últimas ventas" className="lg:col-span-2" testId="recent-sales"
          action={<Link to="/ventas" className="text-xs text-primary hover:underline" data-testid="recent-sales-link">Ver historial</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {d.recent_sales.map((s) => (
                  <tr key={s.sale_id}>
                    <td className="py-2 font-mono-num text-xs">{s.folio}</td>
                    <td className="py-2 text-muted-foreground">{fdate(s.created_at)}</td>
                    <td className="py-2">{s.cashier_name}</td>
                    <td className="py-2">{PAY_LABEL[s.payment_method]}</td>
                    <td className="py-2 text-right font-mono-num">{money(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
