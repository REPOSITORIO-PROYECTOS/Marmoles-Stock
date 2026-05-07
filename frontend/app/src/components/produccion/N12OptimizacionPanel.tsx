import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import {
  fetchN12OptInput,
  fetchN12Visitas,
  n12AprobarOptimizacion,
  n12CrearOP,
  n12EvaluarOptimizacion,
  type N12OptInput,
  type N12VisitaResumen,
} from "../../lib/produccion/n12ProduccionApi";

type RowState = {
  idOptimizacion: string | null;
  loading: "idle" | "evaluar" | "aprobar" | "op";
};

export function N12OptimizacionPanel() {
  const [visitas, setVisitas] = useState<N12VisitaResumen[]>([]);
  const [visitaId, setVisitaId] = useState<string>("");
  const [optRows, setOptRows] = useState<N12OptInput[]>([]);
  const [loadingVisitas, setLoadingVisitas] = useState(false);
  const [loadingInput, setLoadingInput] = useState(false);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  const cargarVisitas = useCallback(async () => {
    setLoadingVisitas(true);
    try {
      const list = await fetchN12Visitas({ estado: "completada" });
      const clean = Array.isArray(list) ? list : [];
      setVisitas(clean);
      setVisitaId((prev) => prev || (clean[0]?.id_visita ?? ""));
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar visitas N12");
      setVisitas([]);
    } finally {
      setLoadingVisitas(false);
    }
  }, []);

  const cargarOptInput = useCallback(async (id: string) => {
    if (!id) {
      setOptRows([]);
      return;
    }
    setLoadingInput(true);
    try {
      const rows = await fetchN12OptInput(id);
      setOptRows(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar optimizador input");
      setOptRows([]);
    } finally {
      setLoadingInput(false);
    }
  }, []);

  useEffect(() => {
    cargarVisitas();
  }, [cargarVisitas]);

  useEffect(() => {
    if (visitaId) cargarOptInput(visitaId);
  }, [visitaId, cargarOptInput]);

  const getRowKey = (row: N12OptInput) => `${row.material}::${row.espesor_mm ?? 0}`;

  const setLoadingFor = (key: string, phase: RowState["loading"]) => {
    setRowState((prev) => ({
      ...prev,
      [key]: { idOptimizacion: prev[key]?.idOptimizacion ?? null, loading: phase },
    }));
  };

  const handleEvaluar = async (row: N12OptInput) => {
    const key = getRowKey(row);
    const visita = visitas.find((v) => v.id_visita === visitaId);
    setLoadingFor(key, "evaluar");
    try {
      const res = await n12EvaluarOptimizacion({
        visita_id: visitaId,
        presupuesto_id: visita?.presupuesto_id ?? null,
        grupo_tecnico: "taller",
        material: row.material,
        espesor_mm: row.espesor_mm ?? undefined,
        criterio_lote: "lote_compatible",
      });
      setRowState((prev) => ({
        ...prev,
        [key]: { idOptimizacion: res.id_optimizacion, loading: "idle" },
      }));
      toast.success(`Optimización evaluada (${res.modo_resolucion})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al evaluar";
      toast.error(msg);
      setLoadingFor(key, "idle");
    }
  };

  const handleAprobar = async (row: N12OptInput) => {
    const key = getRowKey(row);
    const idOpt = rowState[key]?.idOptimizacion;
    if (!idOpt) {
      toast.error("Primero evalúe la optimización para este material.");
      return;
    }
    setLoadingFor(key, "aprobar");
    try {
      await n12AprobarOptimizacion(idOpt);
      toast.success("Optimización aprobada; material reservado y etiquetas generadas.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al aprobar";
      toast.error(msg);
    } finally {
      setLoadingFor(key, "idle");
    }
  };

  const handleCrearOP = async (row: N12OptInput) => {
    const key = getRowKey(row);
    const idOpt = rowState[key]?.idOptimizacion;
    if (!idOpt) {
      toast.error("Primero evalúe (y apruebe) la optimización.");
      return;
    }
    setLoadingFor(key, "op");
    try {
      const res = await n12CrearOP({
        optimizacion_id: idOpt,
        prioridad: "media",
      });
      toast.success(`OP creada: ${res.id_op.slice(0, 8)}…`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear OP";
      toast.error(msg);
    } finally {
      setLoadingFor(key, "idle");
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Nivel 12 — Optimización y OP</CardTitle>
        <p className="text-sm text-muted-foreground">
          Visitas con medidas confirmadas. Por cada grupo de material del optimizador: evaluar, aprobar y crear orden de
          producción.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 min-w-[240px]">
            <Label>Visita completada</Label>
            <Select
              value={visitaId}
              onValueChange={(v) => setVisitaId(v)}
              disabled={loadingVisitas || visitas.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingVisitas ? "Cargando…" : "Elija visita"} />
              </SelectTrigger>
              <SelectContent>
                {visitas.map((v) => (
                  <SelectItem key={v.id_visita} value={v.id_visita}>
                    {v.id_visita.slice(0, 8)} · {v.presupuesto_id.slice(0, 8)} · {v.estado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => cargarVisitas()} disabled={loadingVisitas}>
            Recargar visitas
          </Button>
        </div>

        {loadingInput ? (
          <div className="text-sm text-muted-foreground">Cargando grupos de optimización…</div>
        ) : optRows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No hay optimizador input para esta visita. Cierre la visita técnica (N12) con piezas cargadas.
          </div>
        ) : (
          <div className="space-y-3">
            {optRows.map((row) => {
              const key = getRowKey(row);
              const st = rowState[key];
              const busy = st?.loading && st.loading !== "idle";
              return (
                <div
                  key={row.id_opt_input}
                  className="rounded-lg border bg-white p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{row.material}</div>
                    <div className="text-xs text-muted-foreground">
                      Espesor: {row.espesor_mm ?? "—"} mm · Piezas en grupo: {row.piezas_json?.length ?? 0} · Input:{" "}
                      {row.estado}
                    </div>
                    {st?.idOptimizacion && (
                      <div className="text-xs font-mono mt-1">Optimización: {st.idOptimizacion.slice(0, 8)}…</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" disabled={!!busy} onClick={() => handleEvaluar(row)}>
                      {st?.loading === "evaluar" ? "…" : "Evaluar"}
                    </Button>
                    <Button type="button" size="sm" disabled={!!busy} onClick={() => handleAprobar(row)}>
                      {st?.loading === "aprobar" ? "…" : "Aprobar"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => handleCrearOP(row)}>
                      {st?.loading === "op" ? "…" : "Crear OP"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
