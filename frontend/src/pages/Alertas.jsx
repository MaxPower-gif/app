import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PackageX, Wallet, CheckCircle2 } from "lucide-react";
import { api, errMsg, fdate } from "@/lib/api";
import { PageHeader, Panel } from "@/components/RoleBadge";
import { Button } from "@/components/ui/button";

const SEV = { alta: "border-l-red-500", media: "border-l-amber-500" };

const AlertRow = ({ a, icon: Icon, action }) => (
  <div data-testid={`alert-${a.alert_id}`} className={`flex flex-wrap items-center gap-3 rounded-md border border-border border-l-4 ${a.resolved ? "border-l-emerald-500 opacity-60" : SEV[a.severity]} bg-secondary/40 p-3`}>
    <Icon className={`h-5 w-5 ${a.severity === "alta" ? "text-red-500" : "text-amber-500"}`} />
    <div className="min-w-0 flex-1">
      <div className="text-sm font-semibold">{a.title}</div>
      <div className="text-xs text-muted-foreground">{a.message}{a.created_at ? ` · ${fdate(a.created_at)}` : ""}{a.resolved ? ` · resuelta por ${a.resolved_by}` : ""}</div>
    </div>
    {action}
  </div>
);

export default function Alertas() {
  const navigate = useNavigate();
  const [d, setD] = useState({ stock: [], caja: [] });
  const load = useCallback(() => api.get("/alerts").then((r) => setD(r.data)), []);
  useEffect(() => { load(); }, [load]);
  const resolve = async (id) => {
    try { await api.post(`/alerts/${id}/resolver`); toast.success("Alerta resuelta"); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const pending = d.caja.filter((a) => !a.resolved);
  const done = d.caja.filter((a) => a.resolved);

  return (
    <div data-testid="alertas-page" className="space-y-4">
      <PageHeader title="Centro de alertas" subtitle={`${d.stock.length + pending.length} alertas activas`} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={`Inventario (${d.stock.length})`} testId="alerts-stock-panel">
          <div className="space-y-2">
            {d.stock.length === 0 && <p className="text-sm text-muted-foreground">Todo el inventario está sobre el mínimo.</p>}
            {d.stock.map((a) => <AlertRow key={a.alert_id} a={a} icon={PackageX}
              action={<Button size="sm" variant="outline" onClick={() => navigate("/inventario")} data-testid={`alert-restock-${a.ref_id}`}>Reabastecer</Button>} />)}
          </div>
        </Panel>
        <Panel title={`Caja (${pending.length})`} testId="alerts-caja-panel">
          <div className="space-y-2">
            {pending.length === 0 && <p className="text-sm text-muted-foreground">Sin alertas de caja pendientes.</p>}
            {pending.map((a) => <AlertRow key={a.alert_id} a={a} icon={Wallet} action={
              <div className="flex gap-2">
                {a.type === "caja_limite" && <Button size="sm" variant="outline" onClick={() => navigate("/caja")} data-testid={`alert-retiro-${a.alert_id}`}>Registrar retiro</Button>}
                <Button size="sm" onClick={() => resolve(a.alert_id)} data-testid={`alert-resolve-${a.alert_id}`}><CheckCircle2 className="h-4 w-4 mr-1" />Marcar resuelto</Button>
              </div>} />)}
            {done.length > 0 && <div className="pt-3 text-xs uppercase tracking-widest text-muted-foreground">Resueltas</div>}
            {done.map((a) => <AlertRow key={a.alert_id} a={a} icon={CheckCircle2} />)}
          </div>
        </Panel>
      </div>
    </div>
  );
}
