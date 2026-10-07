import axios from "axios";

export const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: true,
});

export const errMsg = (e) => e?.response?.data?.detail
  ? (typeof e.response.data.detail === "string" ? e.response.data.detail : "Datos inválidos")
  : "Error de conexión";

export const money = (n) =>
  "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fdate = (iso) => iso
  ? new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
  : "—";

export const ROLE_LABEL = { admin: "Administrador", gerente: "Gerente", cajero: "Cajero", pendiente: "Pendiente" };
export const PAY_LABEL = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };
export const MOVE_LABEL = { ingreso: "Ingreso extra", retiro: "Retiro de efectivo", pago_proveedor: "Pago a proveedor" };
