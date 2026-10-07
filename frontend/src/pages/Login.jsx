import { Navigate } from "react-router-dom";
import { ShieldCheck, BarChart3, ShoppingCart, Bell } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Layout";

const FEATURES = [
  { icon: BarChart3, t: "Ingresos y ventas en tiempo real" },
  { icon: ShoppingCart, t: "Punto de venta y caja de supermercado" },
  { icon: Bell, t: "Alertas de stock y diferencias de caja" },
  { icon: ShieldCheck, t: "Roles: Administrador, Gerente y Cajero" },
];

export default function Login() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/" replace />;

  const login = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:block overflow-hidden">
        <img src="https://images.unsplash.com/photo-1752057119009-b6784a9d8dc3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400"
          alt="Caja de supermercado" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#090D16]/75" />
        <div className="relative z-10 flex h-full flex-col justify-end p-12 text-white">
          <p className="text-xs uppercase tracking-[0.35em] text-blue-300">Sistema de gestión comercial</p>
          <h2 className="font-display mt-3 text-5xl font-black uppercase leading-[0.95]">Control total de<br />tu supermercado</h2>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.t} className="flex items-start gap-3 rounded-md border border-white/10 bg-white/5 p-3 backdrop-blur-md">
                <f.icon className="h-5 w-5 shrink-0 text-blue-400" />
                <span className="text-sm text-slate-200">{f.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid-bg flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-2xl rise">
          <Brand />
          <h1 className="font-display mt-10 text-4xl font-black uppercase tracking-tight">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-muted-foreground">Accede con tu cuenta de Google. Un administrador asigna tu rol y permisos.</p>
          <Button onClick={login} data-testid="google-login-btn" className="mt-8 h-12 w-full gap-3 bg-white text-slate-900 hover:bg-slate-100 border border-slate-200">
            <svg className="h-5 w-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continuar con Google
          </Button>
          <p className="mt-6 text-xs text-muted-foreground">Sesión segura con cookie cifrada válida por 7 días.</p>
        </div>
      </div>
    </div>
  );
}
