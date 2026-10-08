import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, PackagePlus, Search, AlertTriangle } from "lucide-react";
import { api, errMsg, money } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Panel } from "@/components/RoleBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EMPTY = { barcode: "", name: "", category: "", cost: "", price: "", stock: "", min_stock: "10", unit: "pieza" };
const FIELDS = [["barcode", "Código de barras"], ["name", "Nombre"], ["cost", "Costo", "number"], ["price", "Precio venta", "number"], ["stock", "Stock", "number"], ["min_stock", "Stock mínimo", "number"]];

const ProductDialog = ({ product, cats, onClose, onSaved }) => {
  const [f, setF] = useState(EMPTY);
  useEffect(() => { setF(product?.product_id ? { ...product } : EMPTY); }, [product]);
  const margin = f.price && f.cost ? (((f.price - f.cost) / f.price) * 100).toFixed(1) : "—";
  const save = async () => {
    const body = { ...f, cost: Number(f.cost), price: Number(f.price), stock: Number(f.stock || 0), min_stock: Number(f.min_stock || 0), unit: f.unit || "pieza" };
    try {
      if (product.product_id) await api.put(`/products/${product.product_id}`, body); else await api.post("/products", body);
      toast.success("Producto guardado"); onSaved();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="product-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl uppercase">{product?.product_id ? "Editar producto" : "Nuevo producto"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map(([k, l, t]) => (
            <div key={k} className={k === "name" ? "col-span-2" : ""}><Label>{l}</Label>
              <Input type={t || "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} data-testid={`product-${k}-input`} /></div>
          ))}
          <div><Label>Categoría</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger data-testid="product-category-select"><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Se vende por</Label>
            <Select value={f.unit || "pieza"} onValueChange={(v) => setF({ ...f, unit: v })}>
              <SelectTrigger data-testid="product-unit-select"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="pieza">Pieza</SelectItem><SelectItem value="kg">Peso (kg)</SelectItem></SelectContent>
            </Select></div>
          <div className="rounded-md bg-secondary p-2"><div className="text-xs text-muted-foreground">Margen</div><div className="font-display text-xl font-bold" data-testid="product-margin">{margin}%</div></div>
        </div>
        <Button onClick={save} disabled={!f.name || !f.barcode || !f.category || !f.price} data-testid="product-save-btn">Guardar</Button>
      </DialogContent>
    </Dialog>
  );
};

const StockDialog = ({ product, onClose, onSaved }) => {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("Recepción de mercancía");
  const save = async () => {
    try { await api.post(`/products/${product.product_id}/stock`, { delta: Number(delta), reason }); toast.success("Stock actualizado"); setDelta(""); onSaved(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="stock-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl uppercase">Ajustar stock</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{product?.name} · stock actual <b>{product?.stock}</b></p>
        <div><Label>Cantidad (+ entrada / − salida)</Label><Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} data-testid="stock-delta-input" /></div>
        <div><Label>Motivo</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} data-testid="stock-reason-input" /></div>
        <Button onClick={save} disabled={!delta || !reason} data-testid="stock-save-btn">Aplicar ajuste</Button>
      </DialogContent>
    </Dialog>
  );
};

export default function Inventario() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [low, setLow] = useState(false);
  const [edit, setEdit] = useState(null);
  const [stock, setStock] = useState(null);

  const load = useCallback(() => api.get("/products", { params: { search: q, category: cat === "all" ? "" : cat, low } }).then((r) => setRows(r.data)), [q, cat, low]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/categories").then((r) => setCats(r.data)); }, []);

  const remove = async (p) => {
    if (!window.confirm(`¿Eliminar ${p.name}?`)) return;
    try { await api.delete(`/products/${p.product_id}`); toast.success("Producto eliminado"); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div data-testid="inventario-page">
      <PageHeader title="Inventario" subtitle={`${rows.length} productos`}>
        {can("productos_editar") && <Button onClick={() => setEdit({})} data-testid="product-new-btn"><Plus className="h-4 w-4 mr-1" />Nuevo producto</Button>}
      </PageHeader>
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código" className="pl-9" data-testid="inv-search-input" /></div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-48" data-testid="inv-category-select"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas las categorías</SelectItem>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant={low ? "destructive" : "outline"} onClick={() => setLow(!low)} data-testid="inv-low-filter-btn"><AlertTriangle className="h-4 w-4 mr-1" />Stock bajo</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr className="text-left">
              <th className="py-2">Código</th><th>Producto</th><th>Categoría</th><th className="text-right">Costo</th><th className="text-right">Precio</th><th className="text-right">Stock</th><th>Estado</th><th></th></tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => {
                const st = p.stock === 0 ? ["Agotado", "bg-red-500/15 text-red-500"] : p.stock <= p.min_stock ? ["Stock bajo", "bg-amber-500/15 text-amber-500"] : ["OK", "bg-emerald-500/15 text-emerald-500"];
                return (
                  <tr key={p.product_id} data-testid={`inv-row-${p.product_id}`}>
                    <td className="py-2.5 font-mono-num text-xs text-muted-foreground">{p.barcode}</td>
                    <td className="font-medium">{p.name}</td><td className="text-muted-foreground">{p.category}</td>
                    <td className="text-right font-mono-num">{money(p.cost)}</td><td className="text-right font-mono-num">{money(p.price)}</td>
                    <td className="text-right font-mono-num font-bold" data-testid={`inv-stock-${p.product_id}`}>{p.stock}{p.unit === "kg" ? " kg" : ""}</td>
                    <td><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${st[1]}`}>{st[0]}</span></td>
                    <td className="text-right whitespace-nowrap">
                      {can("stock") && <Button size="icon" variant="ghost" onClick={() => setStock(p)} data-testid={`inv-stock-btn-${p.product_id}`}><PackagePlus className="h-4 w-4" /></Button>}
                      {can("productos_editar") && <>
                        <Button size="icon" variant="ghost" onClick={() => setEdit(p)} data-testid={`inv-edit-btn-${p.product_id}`}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(p)} data-testid={`inv-delete-btn-${p.product_id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button></>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <ProductDialog product={edit} cats={cats} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
      <StockDialog product={stock} onClose={() => setStock(null)} onSaved={() => { setStock(null); load(); }} />
    </div>
  );
}
