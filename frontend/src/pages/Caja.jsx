import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet, Lock, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { api, errMsg, money, fdate, MOVE_LABEL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Panel } from "@/components/RoleBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const OpenForm = ({ onDone }) => {
  const [amount, setAmount] = useState("500");
  const [notes, setNotes] = useState("");
  const submit = async () => {
    try { onDone((await api.post("/caja/abrir", { opening_amount: Number(amount), notes })).data); toast.success("Caja abierta"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Panel title="Apertura de caja" testId="caja-open-panel">
      <div className="flex items-center gap-3 rounded-md bg-secondary p-4 text-sm"><Lock className="h-5 w-5 text-muted-foreground" />Tu caja está cerrada. Indica el fondo inicial para comenzar el turno.</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr_auto] sm:items-end">
        <div><Label>Monto inicial</Label><Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="caja-opening-amount-input" /></div>
        <div><Label>Notas</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" data-testid="caja-opening-notes-input" /></div>
        <Button onClick={submit} data-testid="caja-open-submit-btn">Abrir caja</Button>
      </div>
    </Panel>
  );
};

const Stat = ({ label, value, testId, strong }) => (
  <div className="rounded-md bg-secondary p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`font-display font-bold tabular-nums ${strong ? "text-3xl text-yellow-500" : "text-xl"}`} data-testid={testId}>{money(value)}</div>
  </div>
);

const MoveForm = ({ onDone }) => {
  const [type, setType] = useState("retiro");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const submit = async () => {
    if (!amount || !reason) return toast.error("Completa monto y motivo");
    try { onDone((await api.post("/caja/movimiento", { type, amount: Number(amount), reason })).data); setAmount(""); setReason(""); toast.success("Movimiento registrado"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="grid gap-3 sm:grid-cols-[170px_120px_1fr_auto] sm:items-end">
      <div><Label>Tipo</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger data-testid="caja-move-type-select"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(MOVE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Monto</Label><Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="caja-move-amount-input" /></div>
      <div><Label>Motivo</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} data-testid="caja-move-reason-input" /></div>
      <Button onClick={submit} variant="secondary" data-testid="caja-move-submit-btn">Registrar</Button>
    </div>
  );
};

const CloseDialog = ({ caja, open, setOpen, onDone }) => {
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const diff = Number(counted || 0) - caja.expected_cash;
  const submit = async () => {
    try { await api.post("/caja/cerrar", { counted_amount: Number(counted), notes }); toast.success("Caja cerrada"); setOpen(false); onDone(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent data-testid="caja-close-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl uppercase">Cierre y arqueo de caja</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Efectivo esperado (sistema)" value={caja.expected_cash} />
          <div className="rounded-md bg-secondary p-3"><div className="text-xs text-muted-foreground">Diferencia</div>
            <div className={`font-display text-xl font-bold ${!counted ? "" : diff < 0 ? "text-red-500" : diff > 0 ? "text-amber-500" : "text-emerald-500"}`} data-testid="caja-close-diff">{counted ? money(diff) : "—"}</div></div>
        </div>
        <div><Label>Efectivo contado</Label><Input type="number" min="0" value={counted} onChange={(e) => setCounted(e.target.value)} data-testid="caja-counted-input" /></div>
        <div><Label>Notas de cierre</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="caja-close-notes-input" /></div>
        <Button disabled={counted === ""} onClick={submit} variant="destructive" data-testid="caja-close-submit-btn">Confirmar cierre</Button>
      </DialogContent>
    </Dialog>
  );
};

const History = ({ rows }) => (
  <Panel title="Historial de cajas" testId="caja-history">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground"><tr className="text-left">
          <th className="py-2">Cajero</th><th>Apertura</th><th>Cierre</th><th className="text-right">Fondo</th><th className="text-right">Esperado</th><th className="text-right">Contado</th><th className="text-right">Diferencia</th></tr></thead>
        <tbody className="divide-y divide-border">
          {rows.map((c) => (
            <tr key={c.caja_id} data-testid={`caja-history-row-${c.caja_id}`}>
              <td className="py-2">{c.user_name}</td><td>{fdate(c.opened_at)}</td>
              <td>{c.status === "abierta" ? <span className="text-emerald-500 font-semibold">Abierta</span> : fdate(c.closed_at)}</td>
              <td className="text-right font-mono-num">{money(c.opening_amount)}</td>
              <td className="text-right font-mono-num">{c.expected_amount != null ? money(c.expected_amount) : "—"}</td>
              <td className="text-right font-mono-num">{c.counted_amount != null ? money(c.counted_amount) : "—"}</td>
              <td className={`text-right font-mono-num ${c.difference < 0 ? "text-red-500" : c.difference > 0 ? "text-amber-500" : ""}`}>{c.difference != null ? money(c.difference) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Panel>
);

export default function Caja() {
  const { user } = useAuth();
  const [caja, setCaja] = useState(undefined);
  const [hist, setHist] = useState([]);
  const [closing, setClosing] = useState(false);
  const load = useCallback(() => {
    api.get("/caja/actual").then((r) => setCaja(r.data));
    api.get("/caja/historial").then((r) => setHist(r.data));
  }, []);
  useEffect(() => { load(); }, [load]);
  const update = (c) => { setCaja(c); api.get("/caja/historial").then((r) => setHist(r.data)); };

  return (
    <div data-testid="caja-page" className="space-y-4">
      <PageHeader title="Caja" subtitle={`Turno de ${user.name}`}>
        {caja && <Button variant="destructive" onClick={() => setClosing(true)} data-testid="caja-close-btn">Cerrar caja</Button>}
      </PageHeader>
      {caja === null && <OpenForm onDone={update} />}
      {caja && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Sesión activa" testId="caja-session-panel" action={<span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-emerald-500" data-testid="caja-status"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />Abierta</span>}>
            <div className="text-xs text-muted-foreground mb-3">Abierta {fdate(caja.opened_at)} · {caja.sales_count} ventas</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Stat strong label="Efectivo en caja (esperado)" value={caja.expected_cash} testId="caja-expected-cash" /></div>
              <Stat label="Fondo inicial" value={caja.opening_amount} testId="caja-opening" />
              <Stat label="Ventas totales" value={caja.sales_total} testId="caja-sales-total" />
              <Stat label="Ventas efectivo" value={caja.sales_efectivo} />
              <Stat label="Ventas tarjeta" value={caja.sales_tarjeta} />
              <Stat label="Transferencias" value={caja.sales_transferencia} />
              <Stat label="Retiros / pagos" value={caja.egresos} />
            </div>
          </Panel>
          <Panel title="Movimientos de caja" testId="caja-moves-panel">
            <MoveForm onDone={setCaja} />
            <div className="mt-4 max-h-80 overflow-y-auto divide-y divide-border">
              {caja.movements.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sin movimientos</p>}
              {caja.movements.map((m) => (
                <div key={m.movement_id} className="flex items-center gap-3 py-2.5" data-testid={`caja-move-${m.movement_id}`}>
                  {m.type === "ingreso" ? <ArrowDownCircle className="h-5 w-5 text-emerald-500" /> : <ArrowUpCircle className="h-5 w-5 text-red-500" />}
                  <div className="flex-1"><div className="text-sm font-medium">{MOVE_LABEL[m.type]}</div><div className="text-xs text-muted-foreground">{m.reason} · {fdate(m.created_at)}</div></div>
                  <span className="font-mono-num text-sm">{m.type === "ingreso" ? "+" : "-"}{money(m.amount)}</span>
                </div>
              ))}
            </div>
          </Panel>
          <CloseDialog caja={caja} open={closing} setOpen={setClosing} onDone={load} />
        </div>
      )}
      {caja === undefined && <div className="text-muted-foreground"><Wallet className="inline h-4 w-4" /> Cargando…</div>}
      <History rows={hist} />
    </div>
  );
}
