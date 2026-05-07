import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Tag, RefreshCw, ScanLine } from "lucide-react";
import { get, post } from "../../api";
import { toast } from "sonner";

type EtiquetaRow = {
  id: string;
  codigo_etiqueta: string;
  tipo: string;
  estado: string;
  orden_produccion_id: string | null;
  op_detalle_id: string | null;
  material_id: string | null;
  metadata_json: Record<string, unknown>;
};

const ESTADOS_ETIQUETA = ["impresa", "en_produccion", "terminada", "entregada"] as const;

export function EtiquetasN12() {
  const [rows, setRows] = useState<EtiquetaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [codigoScan, setCodigoScan] = useState("");
  const [estadoScan, setEstadoScan] = useState<string>("en_produccion");
  const [codigoReprint, setCodigoReprint] = useState("");
  const [motivoReprint, setMotivoReprint] = useState("reimpresion_taller");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (filtroTipo !== "todos") sp.set("tipo", filtroTipo);
      const q = sp.toString();
      const data = await get<EtiquetaRow[]>(`/api/n12/etiquetas${q ? `?${q}` : ""}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Error al listar etiquetas");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filtroTipo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleScan = async () => {
    const c = codigoScan.trim();
    if (!c) {
      toast.error("Ingrese código de etiqueta");
      return;
    }
    try {
      await post(`/api/n12/etiquetas/${encodeURIComponent(c)}/scan`, { estado: estadoScan });
      toast.success(`Etiqueta ${c} actualizada a ${estadoScan}`);
      setCodigoScan("");
      await cargar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error en escaneo");
    }
  };

  const handleReimprimir = async () => {
    const c = codigoReprint.trim();
    if (!c) {
      toast.error("Ingrese código a reimprimir");
      return;
    }
    try {
      const res = await post<{ codigo_nuevo: string }>(`/api/n12/etiquetas/${encodeURIComponent(c)}/reimprimir`, {
        motivo: motivoReprint || undefined,
      });
      toast.success(`Nueva etiqueta: ${res.codigo_nuevo}`);
      setCodigoReprint("");
      await cargar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al reimprimir");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        icon={Tag}
        title="Etiquetas Nivel 12"
        description="Listado, escaneo de estado y reimpresión controlada de etiquetas de pieza y material."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="h-4 w-4" /> Escanear / actualizar estado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Código de etiqueta</Label>
              <Input value={codigoScan} onChange={(e) => setCodigoScan(e.target.value)} placeholder="OP-xxxx-PZ-..." />
            </div>
            <div className="space-y-1">
              <Label>Nuevo estado</Label>
              <Select value={estadoScan} onValueChange={setEstadoScan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_ETIQUETA.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={() => void handleScan()}>
              Registrar escaneo
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Reimprimir (invalida anterior)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Código actual</Label>
              <Input value={codigoReprint} onChange={(e) => setCodigoReprint(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Motivo (opcional)</Label>
              <Input value={motivoReprint} onChange={(e) => setMotivoReprint(e.target.value)} />
            </div>
            <Button type="button" variant="secondary" onClick={() => void handleReimprimir()}>
              Solicitar reimpresión
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Últimas etiquetas</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pieza">Pieza</SelectItem>
                <SelectItem value="material">Material</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={() => void cargar()} disabled={loading}>
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay etiquetas con los filtros actuales.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-2">Código</th>
                    <th className="py-2 pr-2">Tipo</th>
                    <th className="py-2 pr-2">Estado</th>
                    <th className="py-2">OP</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.slice(0, 80).map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-2 font-mono text-xs">{r.codigo_etiqueta}</td>
                      <td className="py-2 pr-2">
                        <Badge variant="outline">{r.tipo}</Badge>
                      </td>
                      <td className="py-2 pr-2">{r.estado}</td>
                      <td className="py-2 font-mono text-xs">
                        {r.orden_produccion_id ? r.orden_produccion_id.slice(0, 8) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
