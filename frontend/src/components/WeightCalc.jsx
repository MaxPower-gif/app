import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { money } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const UNITS = [
  { k: "mg", l: "Miligramos (mg)", kg: 1e-6 }, { k: "g", l: "Gramos (g)", kg: 1e-3 }, { k: "kg", l: "Kilogramos (kg)", kg: 1 },
  { k: "t", l: "Toneladas (t)", kg: 1000 }, { k: "oz", l: "Onzas (oz)", kg: 0.0283495 }, { k: "lb", l: "Libras (lb)", kg: 0.453592 },
];

const fmt = (n) => Number(n.toPrecision(8)).toLocaleString("es-MX", { maximumFractionDigits: 6 });

export const WeightCalc = ({ products, onAdd }) => {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [unit, setUnit] = useState("g");
  const [pid, setPid] = useState("");
  const kgProducts = useMemo(() => products.filter((p) => p.unit === "kg"), [products]);
  const product = kgProducts.find((p) => p.product_id === pid);
  const kg = Number(val || 0) * UNITS.find((u) => u.k === unit).kg;
  const qty = Math.round(kg * 1000) / 1000;
  const add = () => { onAdd(product, qty); setOpen(false); setVal(""); };
  return (
    <>
      <Button variant="outline" className="h-12" onClick={() => setOpen(true)} data-testid="weight-calc-open-btn"><Scale className="h-4 w-4 mr-2" />Báscula</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-testid="weight-calc-dialog">
          <DialogHeader><DialogTitle className="font-display text-2xl uppercase">Calculadora de peso</DialogTitle></DialogHeader>
          <div className="grid grid-cols-[1fr_170px] gap-2">
            <div><Label>Peso</Label><Input type="number" min="0" step="any" value={val} onChange={(e) => setVal(e.target.value)} placeholder="0" className="h-11 text-lg" data-testid="weight-value-input" /></div>
            <div><Label>Unidad</Label>
              <Select value={unit} onValueChange={setUnit}><SelectTrigger className="h-11" data-testid="weight-unit-select"><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map((u) => <SelectItem key={u.k} value={u.k}>{u.l}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs" data-testid="weight-conversions">
            {UNITS.map((u) => (
              <div key={u.k} className={`rounded-md p-2 ${u.k === unit ? "bg-primary/10 text-primary" : "bg-secondary"}`}>
                <div className="uppercase tracking-widest text-[10px] opacity-70">{u.k}</div>
                <div className="font-mono-num font-bold truncate" data-testid={`weight-conv-${u.k}`}>{fmt(kg / u.kg)}</div>
              </div>
            ))}
          </div>
          <div><Label>Producto a granel (precio por kg)</Label>
            <Select value={pid} onValueChange={setPid}><SelectTrigger data-testid="weight-product-select"><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
              <SelectContent>{kgProducts.map((p) => <SelectItem key={p.product_id} value={p.product_id}>{p.name} · {money(p.price)}/kg</SelectItem>)}</SelectContent></Select></div>
          {product && (
            <div className="flex items-end justify-between rounded-md border border-border p-3">
              <div className="text-sm text-muted-foreground">{qty} kg × {money(product.price)}</div>
              <div className="font-display text-3xl font-black" data-testid="weight-price">{money(qty * product.price)}</div>
            </div>
          )}
          <Button disabled={!product || qty <= 0} onClick={add} data-testid="weight-add-btn">Agregar al carrito</Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
