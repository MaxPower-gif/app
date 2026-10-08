import { useState } from "react";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const lastMonths = (n) => Array.from({ length: n }, (_, i) => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
  return { v: `${d.getFullYear()}-${d.getMonth() + 1}`, l: `${MESES[d.getMonth()]} ${d.getFullYear()}` };
});

export const ReportButton = () => {
  const { can } = useAuth();
  const [opts] = useState(() => lastMonths(12));
  const [sel, setSel] = useState(opts[0].v);
  const [busy, setBusy] = useState(false);
  if (!can("reportes")) return null;
  const download = async () => {
    const [year, month] = sel.split("-");
    setBusy(true);
    try {
      const { data } = await api.get("/reports/monthly", { params: { year, month }, responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(data);
      a.download = `reporte_ingresos_${year}_${String(month).padStart(2, "0")}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Reporte PDF generado");
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <div className="flex gap-2" data-testid="report-controls">
      <Select value={sel} onValueChange={setSel}>
        <SelectTrigger className="w-44" data-testid="report-month-select"><SelectValue /></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
      </Select>
      <Button variant="outline" onClick={download} disabled={busy} data-testid="report-download-btn">
        <FileDown className="h-4 w-4 mr-1" />{busy ? "Generando…" : "Reporte PDF"}
      </Button>
    </div>
  );
};
