import { useNavigate } from "react-router-dom";
import { Clock3 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Layout";

export default function Pending() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen grid-bg grid place-items-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 rise" data-testid="pending-screen">
        <Brand />
        <Clock3 className="mt-8 h-10 w-10 text-amber-500" />
        <h1 className="font-display mt-4 text-3xl font-black uppercase">{user.active === false ? "Cuenta desactivada" : "Acceso pendiente"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Hola {user.name}. Tu cuenta ({user.email}) aún no tiene un rol asignado. Pide a un administrador que te asigne
          el rol de Gerente o Cajero.
        </p>
        <div className="mt-6 flex gap-2">
          <Button onClick={refresh} data-testid="pending-refresh-btn">Volver a comprobar</Button>
          <Button variant="outline" data-testid="pending-logout-btn" onClick={async () => { await logout(); navigate("/login"); }}>Cerrar sesión</Button>
        </div>
      </div>
    </div>
  );
}
