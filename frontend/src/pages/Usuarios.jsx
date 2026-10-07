import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, Check, X } from "lucide-react";
import { api, errMsg, fdate, ROLE_LABEL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Panel, RoleBadge } from "@/components/RoleBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PERM_LABEL = {
  dashboard: "Dashboard e ingresos", ventas: "Ver ventas", ventas_todas: "Ventas de todos los cajeros", anular: "Anular ventas",
  alertas: "Centro de alertas", pos: "Punto de venta", caja: "Abrir / cerrar caja", caja_todas: "Historial de todas las cajas",
  productos: "Ver productos", productos_editar: "Crear / editar / eliminar productos", stock: "Ajustar stock", usuarios: "Gestionar usuarios y roles",
};
const ROLES = ["admin", "gerente", "cajero", "pendiente"];

const RoleSelect = ({ value, onChange, testId, disabled }) => (
  <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger className="w-40" data-testid={testId}><SelectValue /></SelectTrigger>
    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
  </Select>
);

const AddDialog = ({ open, setOpen, onSaved }) => {
  const [f, setF] = useState({ email: "", name: "", role: "cajero" });
  const save = async () => {
    try { await api.post("/users", f); toast.success("Usuario autorizado"); setF({ email: "", name: "", role: "cajero" }); setOpen(false); onSaved(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent data-testid="user-add-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl uppercase">Autorizar usuario</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">El usuario podrá entrar con esta cuenta de Google y tendrá el rol asignado.</p>
        <div><Label>Email de Google</Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="user-email-input" /></div>
        <div><Label>Nombre</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="user-name-input" /></div>
        <div><Label>Rol</Label><RoleSelect value={f.role} onChange={(role) => setF({ ...f, role })} testId="user-role-select" /></div>
        <Button onClick={save} disabled={!f.email || !f.name} data-testid="user-save-btn">Guardar</Button>
      </DialogContent>
    </Dialog>
  );
};

const Matrix = ({ roles }) => (
  <Panel title="Matriz de permisos" testId="perm-matrix">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2">Permiso</th>{["admin", "gerente", "cajero"].map((r) => <th key={r} className="text-center"><RoleBadge role={r} testId={`matrix-${r}`} /></th>)}</tr></thead>
        <tbody className="divide-y divide-border">
          {Object.entries(PERM_LABEL).map(([k, l]) => (
            <tr key={k}><td className="py-2">{l}</td>
              {["admin", "gerente", "cajero"].map((r) => <td key={r} className="text-center">{roles[r]?.includes(k) ? <Check className="inline h-4 w-4 text-emerald-500" /> : <X className="inline h-4 w-4 text-muted-foreground/40" />}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Panel>
);

export default function Usuarios() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState({});
  const [open, setOpen] = useState(false);
  const load = useCallback(() => api.get("/users").then((r) => setRows(r.data)), []);
  useEffect(() => { load(); api.get("/roles").then((r) => setRoles(r.data)); }, [load]);
  const update = async (id, body) => {
    try { await api.put(`/users/${id}`, body); toast.success("Usuario actualizado"); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div data-testid="usuarios-page" className="space-y-4">
      <PageHeader title="Usuarios y roles" subtitle="Controla quién accede y qué puede hacer">
        <Button onClick={() => setOpen(true)} data-testid="user-add-btn"><UserPlus className="h-4 w-4 mr-1" />Autorizar usuario</Button>
      </PageHeader>
      <Panel testId="users-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr className="text-left"><th className="py-2">Usuario</th><th>Rol</th><th>Último acceso</th><th>Activo</th></tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((u) => {
                const self = u.user_id === me.user_id;
                return (
                  <tr key={u.user_id} data-testid={`user-row-${u.user_id}`}>
                    <td className="py-3"><div className="flex items-center gap-3">
                      {u.picture ? <img src={u.picture} alt="" className="h-8 w-8 rounded-full" /> : <div className="h-8 w-8 rounded-full bg-secondary grid place-items-center text-xs font-bold">{u.name?.[0]}</div>}
                      <div><div className="font-medium">{u.name}{self && <span className="ml-1 text-xs text-muted-foreground">(tú)</span>}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
                    </div></td>
                    <td><RoleSelect value={u.role} disabled={self} onChange={(role) => update(u.user_id, { role })} testId={`user-role-${u.user_id}`} /></td>
                    <td className="text-muted-foreground">{u.last_login ? fdate(u.last_login) : "Nunca"}</td>
                    <td><Switch checked={u.active !== false} disabled={self} onCheckedChange={(active) => update(u.user_id, { active })} data-testid={`user-active-${u.user_id}`} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Matrix roles={roles} />
      <AddDialog open={open} setOpen={setOpen} onSaved={load} />
    </div>
  );
}
