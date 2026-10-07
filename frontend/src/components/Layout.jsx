import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Wallet, Package, Receipt, Bell, Users, LogOut, Menu, Sun, Moon, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/RoleBadge";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" },
  { to: "/pos", label: "Punto de Venta", icon: ShoppingCart, perm: "pos" },
  { to: "/caja", label: "Caja", icon: Wallet, perm: "caja" },
  { to: "/ventas", label: "Ventas", icon: Receipt, perm: "ventas" },
  { to: "/inventario", label: "Inventario", icon: Package, perm: "productos" },
  { to: "/alertas", label: "Alertas", icon: Bell, perm: "alertas" },
  { to: "/usuarios", label: "Usuarios y Roles", icon: Users, perm: "usuarios" },
];

export const Brand = () => (
  <div className="flex items-center gap-2" data-testid="brand-logo">
    <div className="h-9 w-9 rounded-md bg-primary grid place-items-center"><Zap className="h-5 w-5 text-white" fill="currentColor" /></div>
    <div className="leading-none">
      <div className="font-display text-xl font-black uppercase tracking-tight">Max Power</div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Bussines</div>
    </div>
  </div>
);

const NavItems = ({ onClick }) => {
  const { can } = useAuth();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.filter((n) => can(n.perm)).map((n) => (
        <NavLink key={n.to} to={n.to} onClick={onClick} data-testid={`nav-${n.to.slice(1)}`}
          className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
          <n.icon className="h-4 w-4" /> {n.label}
        </NavLink>
      ))}
    </nav>
  );
};

const Clock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return (
    <div className="hidden md:block text-right leading-tight" data-testid="header-clock">
      <div className="font-display text-lg font-bold">{now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</div>
      <div className="text-xs text-muted-foreground capitalize">{now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</div>
    </div>
  );
};

const AlertBell = () => {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!can("alertas")) return;
    const load = () => api.get("/alerts/count").then((r) => setCount(r.data.count)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [can]);
  if (!can("alertas")) return null;
  return (
    <Button variant="ghost" size="icon" className="relative" onClick={() => navigate("/alertas")} data-testid="header-alerts-btn">
      <Bell className="h-5 w-5" />
      {count > 0 && <span data-testid="header-alerts-count" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-[10px] font-bold text-white grid place-items-center">{count}</span>}
    </Button>
  );
};

const ThemeToggle = () => {
  const [dark, setDark] = useState(() => localStorage.getItem("mp-theme") !== "light");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("mp-theme", dark ? "dark" : "light");
  }, [dark]);
  return (
    <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} data-testid="theme-toggle-btn">
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
};

const UserBox = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 border-t border-border pt-4">
      {user.picture ? <img src={user.picture} alt="" className="h-9 w-9 rounded-full" /> :
        <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center font-bold">{user.name?.[0]}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold" data-testid="sidebar-user-name">{user.name}</div>
        <RoleBadge role={user.role} />
      </div>
      <Button variant="ghost" size="icon" data-testid="logout-btn" onClick={async () => { await logout(); navigate("/login"); }}>
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col gap-8 border-r border-border bg-card p-5 sticky top-0 h-screen">
        <Brand />
        <div className="flex-1"><NavItems /></div>
        <UserBox />
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 backdrop-blur-xl px-4 sm:px-6 h-16">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" data-testid="mobile-menu-btn"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 flex flex-col gap-8 p-5">
              <Brand />
              <div className="flex-1"><NavItems onClick={() => setOpen(false)} /></div>
              <UserBox />
            </SheetContent>
          </Sheet>
          <div className="lg:hidden"><Brand /></div>
          <div className="hidden lg:block text-xs uppercase tracking-[0.25em] text-muted-foreground">Sucursal Principal</div>
          <div className="flex-1" />
          <Clock />
          <AlertBell />
          <ThemeToggle />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
