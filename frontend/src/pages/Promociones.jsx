import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { api, errMsg, money } from "@/lib/api";
import { PageHeader, Panel } from "@/components/RoleBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const today = () => new Date().toISOString().slice(0, 10);
const plus = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const EMPTY = { product_id: "", type: "descuento", percent: "10", start_date: today(), end_date: plus(14), active: true };

const PromoDialog = ({ promo, products, onClose, onSaved }) => {
  const [f, setF] = useState(EMPTY);
  useEffect(() => { setF(promo?.promo_id ? { ...promo, percent: String(promo.percent) } : EMPTY); }, [promo]);
  const prod = products.find((p) => p.product_id === f.product_id);
  const save = async () => {
    const body = { ...f, percent: f.type === "2x1" ? 0 : Number(f.percent) };
    try {
      if (promo.promo_id) await api.put(`/promotions/${promo.promo_id}`, body); else await api.post("/promotions", body);
      toast.success("Promoción guardada"); onSaved();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={!!promo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="promo-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl uppercase">{promo?.promo_id ? "Editar promoción" : "Nueva promoción"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Producto</Label>
            <Select value={f.product_id} onValueChange={(v) => setF({ ...f, product_id: v })}>
              <SelectTrigger data-testid="promo-product-select"><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.product_id} value={p.product_id}>{p.name} · {money(p.price)}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Tipo</Label>
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
              <SelectTrigger data-testid="promo-type-select"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="descuento">Descuento %</SelectItem><SelectItem value="2x1">Promoción 2x1</SelectItem></SelectContent>
            </Select></div>
          <div><Label>Porcentaje</Label><Input type="number" min="1" max="100" disabled={f.type === "2x1"} value={f.type === "2x1" ? "" : f.percent} onChange={(e) => setF({ ...f, percent: e.target.value })} data-testid="promo-percent-input" /></div>
          <div><Label>Inicio</Label><Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} data-testid="promo-start-input" /></div>
          <div><Label>Fin</Label><Input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} data-testid="promo-end-input" /></div>
          <div className="col-span-2 flex items-center justify-between rounded-md bg-secondary p-3">
            <div className="text-sm">
              <div className="text-xs text-muted-foreground">Vista previa</div>
              <div className="font-semibold" data-testid="promo-preview">{prod ? (f.type === "2x1" ? `2 × ${prod.name} por ${money(prod.price)}` : `${prod.name}: ${money(prod.price)} → ${money(prod.price * (1 - Number(f.percent || 0) / 100))}`) : "—"}</div>
            </div>
            <div className="flex items-center gap-2"><Label className="text-xs">Activa</Label><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} data-testid="promo-active-switch" /></div>
          </div>
        </div>
        <Button onClick={save} disabled={!f.product_id || !f.start_date || !f.end_date || (f.type === "descuento" && !(Number(f.percent) > 0))} data-testid="promo-save-btn">Guardar</Button>
      </DialogContent>
    </Dialog>
  );
};

const PromoBadge = ({ p }) => (
  <span data-testid={`promo-label-${p.promo_id}`} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-black ${p.type === "2x1" ? "bg-emerald-500/15 text-emerald-500" : "bg-primary/15 text-primary"}`}>
    <Tag className="h-3 w-3" />{p.label}
  </span>
);

export default function Promociones() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => api.get("/promotions").then((r) => setRows(r.data)), []);
  useEffect(() => { load(); api.get("/products").then((r) => setProducts(r.data)); }, [load]);

  const remove = async (p) => {
    if (!window.confirm(`¿Eliminar promoción de ${p.product_name}?`)) return;
    try { await api.delete(`/promotions/${p.promo_id}`); toast.success("Promoción eliminada"); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const toggle = async (p) => {
    try { await api.put(`/promotions/${p.promo_id}`, { ...p, active: !p.active }); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const live = rows.filter((r) => r.live).length;

  return (
    <div data-testid="promociones-page">
      <PageHeader title="Promociones" subtitle={`${live} promociones vigentes · se aplican automáticamente al cobrar`}>
        <Button onClick={() => setEdit({})} data-testid="promo-new-btn"><Plus className="h-4 w-4 mr-1" />Nueva promoción</Button>
      </PageHeader>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr className="text-left">
              <th className="py-2">Producto</th><th>Promoción</th><th className="text-right">Precio</th><th className="text-right">Precio promo</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.promo_id} data-testid={`promo-row-${p.promo_id}`}>
                  <td className="py-2.5 font-medium">{p.product_name}</td>
                  <td><PromoBadge p={p} /></td>
                  <td className="text-right font-mono-num">{money(p.price)}</td>
                  <td className="text-right font-mono-num font-bold">{p.type === "2x1" ? `2 por ${money(p.price)}` : money(p.price * (1 - p.percent / 100))}</td>
                  <td className="text-xs text-muted-foreground">{p.start_date} → {p.end_date}</td>
                  <td><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${p.live ? "bg-emerald-500/15 text-emerald-500" : "bg-secondary text-muted-foreground"}`} data-testid={`promo-status-${p.promo_id}`}>{p.live ? "Vigente" : p.active ? "Fuera de fecha" : "Inactiva"}</span></td>
                  <td className="text-right whitespace-nowrap">
                    <Switch checked={p.active} onCheckedChange={() => toggle(p)} className="mr-2 align-middle" data-testid={`promo-toggle-${p.promo_id}`} />
                    <Button size="icon" variant="ghost" onClick={() => setEdit(p)} data-testid={`promo-edit-btn-${p.promo_id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p)} data-testid={`promo-delete-btn-${p.promo_id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="py-10 text-center text-muted-foreground" data-testid="promo-empty">Aún no hay promociones</p>}
        </div>
      </Panel>
      <PromoDialog promo={edit} products={products} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
    </div>
  );
}
