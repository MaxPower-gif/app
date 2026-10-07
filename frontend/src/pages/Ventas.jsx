import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Ban } from "lucide-react";
import { api, errMsg, money, fdate, PAY_LABEL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Panel } from "@/components/RoleBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const exportCsv = (rows) => {
  const head = "Folio,Fecha,Cajero,Metodo,Subtotal,IVA,Total,Estado\n";
  const body = rows.map((s) => [s.folio, s.created_at, s.cashier_name, s.payment_method, s.subtotal, s.tax, s.total, s.status].join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([head + body], { type: "text/csv" }));
  a.download = "ventas_max_power.csv";
  a.click();
};

const Detail = ({ sale, onClose, onVoided }) => {
  const { can } = useAuth();
  const [reason, setReason] = useState("");
  const anular = async () => {
    try { await api.post(`/sales/${sale.sale_id}/anular`, { reason }); toast.success("Venta anulada y stock restaurado"); setReason(""); onVoided(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Sheet open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" data-testid="sale-detail-sheet">
        <SheetHeader><SheetTitle className="font-display text-2xl uppercase">Ticket {sale?.folio}</SheetTitle></SheetHeader>
        {sale && (
          <div className="mt-4 space-y-4 text-sm">
            <div className="text-muted-foreground">{fdate(sale.created_at)} · {sale.cashier_name} · {PAY_LABEL[sale.payment_method]}</div>
            <div className="divide-y divide-border rounded-md border border-border">
              {sale.items.map((i) => <div key={i.product_id} className="flex justify-between p-2"><span>{i.quantity} × {i.name}</span><span className="font-mono-num">{money(i.line_total)}</span></div>)}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(sale.subtotal)}</span></div>
              <div className="flex justify-between"><span>IVA</span><span>{money(sale.tax)}</span></div>
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(sale.total)}</span></div>
            </div>
            {sale.status === "anulada" ? (
              <div className="rounded-md bg-red-500/10 p-3 text-red-500" data-testid="sale-voided-info">Anulada{sale.voided_by ? ` por ${sale.voided_by}` : ""}{sale.void_reason ? `: ${sale.void_reason}` : ""}</div>
            ) : can("anular") && (
              <div className="space-y-2 rounded-md border border-red-500/30 p-3">
                <div className="font-semibold">Anular venta</div>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de anulación" data-testid="sale-void-reason-input" />
                <Button variant="destructive" disabled={!reason} onClick={anular} className="w-full" data-testid="sale-void-btn"><Ban className="h-4 w-4 mr-1" />Anular</Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default function Ventas() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [days, setDays] = useState("7");
  const [pm, setPm] = useState("all");
  const [st, setSt] = useState("all");
  const [sel, setSel] = useState(null);
  const load = useCallback(() => api.get("/sales", { params: { days, payment_method: pm === "all" ? "" : pm, status: st === "all" ? "" : st } }).then((r) => setRows(r.data)), [days, pm, st]);
  useEffect(() => { load(); }, [load]);
  const total = rows.filter((s) => s.status === "completada").reduce((a, s) => a + s.total, 0);

  return (
    <div data-testid="ventas-page">
      <PageHeader title="Historial de ventas" subtitle={can("ventas_todas") ? "Todas las ventas de la empresa" : "Tus ventas"}>
        <Button variant="outline" onClick={() => exportCsv(rows)} data-testid="ventas-export-btn"><Download className="h-4 w-4 mr-1" />Exportar CSV</Button>
      </PageHeader>
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select value={days} onValueChange={setDays}><SelectTrigger className="w-36" data-testid="ventas-days-select"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="1">Hoy</SelectItem><SelectItem value="7">7 días</SelectItem><SelectItem value="30">30 días</SelectItem></SelectContent></Select>
          <Select value={pm} onValueChange={setPm}><SelectTrigger className="w-40" data-testid="ventas-method-select"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos los métodos</SelectItem>{Object.entries(PAY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          <Select value={st} onValueChange={setSt}><SelectTrigger className="w-40" data-testid="ventas-status-select"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="completada">Completada</SelectItem><SelectItem value="anulada">Anulada</SelectItem></SelectContent></Select>
          <div className="ml-auto text-sm"><span className="text-muted-foreground">{rows.length} tickets · </span><b className="font-display text-xl" data-testid="ventas-total">{money(total)}</b></div>
        </div>
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-xs uppercase text-muted-foreground"><tr className="text-left"><th className="py-2">Folio</th><th>Fecha</th><th>Cajero</th><th>Artículos</th><th>Método</th><th>Estado</th><th className="text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((s) => (
                <tr key={s.sale_id} onClick={() => setSel(s)} className="cursor-pointer hover:bg-secondary/60" data-testid={`sale-row-${s.sale_id}`}>
                  <td className="py-2.5 font-mono-num text-xs">{s.folio}</td><td>{fdate(s.created_at)}</td><td>{s.cashier_name}</td>
                  <td>{s.items.reduce((a, i) => a + i.quantity, 0)}</td><td>{PAY_LABEL[s.payment_method]}</td>
                  <td><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${s.status === "anulada" ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-500"}`}>{s.status}</span></td>
                  <td className="text-right font-mono-num">{money(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="py-10 text-center text-muted-foreground" data-testid="ventas-empty">Sin ventas en este periodo</p>}
        </div>
      </Panel>
      <Detail sale={sel} onClose={() => setSel(null)} onVoided={() => { setSel(null); load(); }} />
    </div>
  );
}
