import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, Banknote, CreditCard, ArrowLeftRight, Lock, Printer } from "lucide-react";
import { api, errMsg, money, fdate, PAY_LABEL } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TAX = 0.16;
const PAYS = [{ k: "efectivo", i: Banknote }, { k: "tarjeta", i: CreditCard }, { k: "transferencia", i: ArrowLeftRight }];

const ProductCard = ({ p, onAdd }) => {
  const low = p.stock <= p.min_stock;
  return (
    <button data-testid={`pos-product-${p.product_id}`} disabled={p.stock === 0} onClick={() => onAdd(p)}
      className="group text-left rounded-lg border border-border bg-card p-3 transition-[transform,border-color] hover:-translate-y-0.5 hover:border-primary disabled:opacity-40 disabled:hover:translate-y-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{p.category}</span>
        <span className={`rounded px-1.5 text-[10px] font-bold ${low ? "bg-red-500/15 text-red-500" : "bg-secondary text-muted-foreground"}`}>{p.stock} u</span>
      </div>
      <div className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight">{p.name}</div>
      <div className="mt-2 flex items-end justify-between">
        <span className="font-display text-xl font-bold text-primary">{money(p.price)}</span>
        <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
      </div>
    </button>
  );
};

const Ticket = ({ sale, onClose }) => (
  <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-w-sm" data-testid="ticket-dialog">
      <DialogHeader><DialogTitle className="font-display text-2xl uppercase">Venta completada</DialogTitle></DialogHeader>
      {sale && (
        <div className="font-mono-num text-xs space-y-1" id="ticket-print">
          <div className="text-center font-bold">MAX POWER BUSSINES</div>
          <div className="text-center text-muted-foreground">{sale.folio} · {fdate(sale.created_at)}</div>
          <div className="text-center text-muted-foreground">Cajero: {sale.cashier_name}</div>
          <div className="border-t border-dashed border-border my-2" />
          {sale.items.map((i) => <div key={i.product_id} className="flex justify-between gap-2"><span className="truncate">{i.quantity} x {i.name}</span><span>{money(i.line_total)}</span></div>)}
          <div className="border-t border-dashed border-border my-2" />
          <div className="flex justify-between"><span>Subtotal</span><span>{money(sale.subtotal)}</span></div>
          <div className="flex justify-between"><span>IVA</span><span>{money(sale.tax)}</span></div>
          <div className="flex justify-between text-base font-bold"><span>TOTAL</span><span data-testid="ticket-total">{money(sale.total)}</span></div>
          <div className="flex justify-between"><span>{PAY_LABEL[sale.payment_method]}</span><span>{money(sale.cash_received)}</span></div>
          <div className="flex justify-between font-bold"><span>Cambio</span><span data-testid="ticket-change">{money(sale.change)}</span></div>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => window.print()} data-testid="ticket-print-btn"><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
        <Button className="flex-1" onClick={onClose} data-testid="ticket-new-sale-btn">Nueva venta</Button>
      </div>
    </DialogContent>
  </Dialog>
);

const CartLine = ({ l, onQty, onRemove }) => (
  <div className="flex items-center gap-2 py-2" data-testid={`cart-line-${l.product_id}`}>
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium">{l.name}</div>
      <div className="text-xs text-muted-foreground">{money(l.price)} c/u</div>
    </div>
    <div className="flex items-center gap-1">
      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onQty(-1)} data-testid={`cart-dec-${l.product_id}`}><Minus className="h-3 w-3" /></Button>
      <span className="w-7 text-center font-mono-num text-sm" data-testid={`cart-qty-${l.product_id}`}>{l.qty}</span>
      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onQty(1)} data-testid={`cart-inc-${l.product_id}`}><Plus className="h-3 w-3" /></Button>
    </div>
    <span className="w-20 text-right font-mono-num text-sm">{money(l.price * l.qty)}</span>
    <button onClick={onRemove} className="text-muted-foreground hover:text-red-500" data-testid={`cart-remove-${l.product_id}`}><Trash2 className="h-4 w-4" /></button>
  </div>
);

export default function POS() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);
  const [pay, setPay] = useState("efectivo");
  const [cash, setCash] = useState("");
  const [caja, setCaja] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [sale, setSale] = useState(null);

  const load = useCallback(() => api.get("/products").then((r) => setProducts(r.data)), []);
  useEffect(() => {
    load();
    api.get("/categories").then((r) => setCats(r.data));
    api.get("/caja/actual").then((r) => setCaja(r.data));
  }, [load]);

  const shown = useMemo(() => products.filter((p) => (!cat || p.category === cat) &&
    (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.barcode.includes(q))), [products, cat, q]);

  const add = (p) => setCart((c) => {
    const ex = c.find((l) => l.product_id === p.product_id);
    if ((ex?.qty || 0) + 1 > p.stock) { toast.error(`Stock insuficiente: ${p.name}`); return c; }
    return ex ? c.map((l) => (l === ex ? { ...l, qty: l.qty + 1 } : l)) : [...c, { ...p, qty: 1 }];
  });
  const setQty = (id, d) => setCart((c) => c.flatMap((l) => {
    if (l.product_id !== id) return [l];
    const n = l.qty + d;
    if (n > l.stock) { toast.error("Stock insuficiente"); return [l]; }
    return n <= 0 ? [] : [{ ...l, qty: n }];
  }));

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const tax = Math.round(subtotal * TAX * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const change = Number(cash || 0) - total;

  const onScan = (e) => {
    if (e.key !== "Enter") return;
    const p = products.find((x) => x.barcode === q.trim());
    if (p) { add(p); setQ(""); }
  };

  const checkout = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/sales", {
        items: cart.map((l) => ({ product_id: l.product_id, quantity: l.qty })),
        payment_method: pay, cash_received: pay === "efectivo" ? Number(cash) : null,
      });
      setSale(data); setCart([]); setCash(""); load();
      toast.success(`Venta ${data.folio} registrada`);
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  const canPay = cart.length && caja && (pay !== "efectivo" || change >= 0);

  return (
    <div data-testid="pos-page" className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
      <div className="min-w-0">
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight rise">Punto de Venta</h1>
        {caja === null && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm" data-testid="pos-no-caja-banner">
            <Lock className="h-4 w-4 text-amber-500" /> No tienes una caja abierta. Abre caja para empezar a vender.
            <Button asChild size="sm" className="ml-auto"><Link to="/caja" data-testid="pos-open-caja-link">Abrir caja</Link></Button>
          </div>
        )}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onScan} placeholder="Buscar producto o escanear código de barras + Enter"
            className="h-12 pl-10 text-base" data-testid="pos-search-input" />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {["", ...cats].map((c) => (
            <button key={c || "all"} onClick={() => setCat(c)} data-testid={`pos-cat-${c || "todas"}`}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${cat === c ? "border-primary bg-primary text-white" : "border-border hover:border-primary"}`}>
              {c || "Todas"}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3" data-testid="pos-grid">
          {shown.map((p) => <ProductCard key={p.product_id} p={p} onAdd={add} />)}
        </div>
      </div>

      <aside className="xl:sticky xl:top-20 h-fit rounded-lg border border-border bg-card p-5" data-testid="pos-cart">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold uppercase">Carrito</h2>
          {cart.length > 0 && <button className="text-xs text-red-500 hover:underline" onClick={() => setCart([])} data-testid="cart-clear-btn">Vaciar</button>}
        </div>
        <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-border">
          {cart.length ? cart.map((l) => <CartLine key={l.product_id} l={l} onQty={(d) => setQty(l.product_id, d)} onRemove={() => setQty(l.product_id, -l.qty)} />)
            : <p className="py-10 text-center text-sm text-muted-foreground" data-testid="cart-empty">Agrega productos al carrito</p>}
        </div>
        <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono-num" data-testid="cart-subtotal">{money(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">IVA (16%)</span><span className="font-mono-num">{money(tax)}</span></div>
          <div className="flex items-end justify-between pt-2"><span className="font-bold uppercase">Total</span><span className="font-display text-4xl font-black" data-testid="cart-total">{money(total)}</span></div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {PAYS.map(({ k, i: Icon }) => (
            <button key={k} onClick={() => setPay(k)} data-testid={`pay-method-${k}`}
              className={`flex flex-col items-center gap-1 rounded-md border p-2.5 text-xs font-semibold transition-colors ${pay === k ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
              <Icon className="h-4 w-4" />{PAY_LABEL[k]}
            </button>
          ))}
        </div>
        {pay === "efectivo" && (
          <div className="mt-3">
            <Input type="number" min="0" step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="Efectivo recibido" className="h-11" data-testid="pos-cash-input" />
            <div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">Cambio</span>
              <span className={`font-mono-num font-bold ${change < 0 ? "text-red-500" : "text-emerald-500"}`} data-testid="pos-change">{cash ? money(change) : "—"}</span></div>
          </div>
        )}
        <Button disabled={!canPay || busy} onClick={checkout} className="mt-4 h-14 w-full font-display text-xl font-bold uppercase tracking-wide" data-testid="pos-checkout-btn">
          {busy ? "Procesando…" : `Cobrar ${money(total)}`}
        </Button>
      </aside>
      <Ticket sale={sale} onClose={() => setSale(null)} />
    </div>
  );
}
