import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Separator } from "../../components/ui/separator";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { PlanchaMapa } from "../../components/produccion/PlanchaMapa";
import { fetchTrabajos, groupTrabajos, areaPieza, totalAreaTrabajo, type Pieza, type TrabajoPendiente, type Acumulador, fetchAcumulados, crearAcumulado, generarPlanAcumulado, aprobarPlanAcumulado } from "../../lib/produccion/plan";
import { imprimirEtiquetaPieza, imprimirPlanDeCorte } from "../../lib/produccion/printing";
import { DialogPlanCorte } from "../../components/produccion/DialogPlanCorte";
import { DialogDXF } from "../../components/produccion/DialogDXF";
import { CheckCircle2, XCircle, AlertTriangle, Printer, Trash2, Play, Eye, Check, Download, Upload, RotateCcw } from "lucide-react";
import { post, del } from "../../api";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";

type ClaveGrupo = "material" | "material_color" | "espesor";

const SYSTEM_CONFIG = {
  showThicknessInApproval: true
};

export function ListaPendientes() {
  const [busqueda, setBusqueda] = useState("");
  const [claveGrupo, setClaveGrupo] = useState<ClaveGrupo>("material");
  const [openDialog, setOpenDialog] = useState(false);
  const [dxfDialogOpen, setDxfDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ key: string; piezas: Pieza[]; material: string; trabajos: TrabajoPendiente[] } | null>(null);
  const [trabajos, setTrabajos] = useState<TrabajoPendiente[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>("todas");
  const [filtroMaterial, setFiltroMaterial] = useState<string>("todos");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [acumulados, setAcumulados] = useState<Acumulador[]>([]);
  const [piezasSeleccionadas, setPiezasSeleccionadas] = useState<Set<string>>(new Set());
  const [mostrarCortadas, setMostrarCortadas] = useState<boolean>(false);
  const [piezasCortadas, setPiezasCortadas] = useState<Set<string>>(new Set());

  const eliminarTrabajo = async (id: string) => {
    if (!confirm("¿Está seguro de que desea eliminar este trabajo de la lista?")) return;
    try {
      await post(`/api/trabajos/${id}/eliminar`, {});
      toast.success("Trabajo eliminado correctamente");
      recargarTrabajos();
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar el trabajo");
    }
  };

  const handleEliminarPieza = async (piezaId: string) => {
    if (!confirm("¿Está seguro de que desea eliminar esta pieza (etiqueta)?")) return;

    try {
      await del(`/api/piezas/${piezaId}`);
      toast.success("Pieza eliminada correctamente");
      recargarTrabajos(); // Recargar la lista para reflejar los cambios
    } catch (error: any) {
      console.error("Error eliminando pieza:", error);
      toast.error(error.message || "Error al eliminar la pieza");
    }
  };

  const recargarAcumulados = () => {
    fetchAcumulados()
      .then(setAcumulados)
      .catch(() => setAcumulados([]));
  };

  const recargarTrabajos = () => {
    let mounted = true;
    setCargando(true);
    setError(null);
    fetchTrabajos()
      .then((data) => {
        if (!mounted) return;
        // Incluir trabajos en estados: pendiente, planificacion, en_acumulador
        // Estos son trabajos que AÚN NO tienen lote asignado
        const soloPendientes = data.filter((t: any) =>
          !t.estado ||
          t.estado === "pendiente" ||
          t.estado === "planificacion" ||
          t.estado === "en_acumulador" ||
          (t.estado === "listo_para_corte" && !t.lote) // Si está listo pero sin lote, incluir
        ).map((t: any) => ({
          ...t,
          // Forzamos aprobación por defecto según pedido del usuario para agilizar flujo
          visita_tecnica: t.visita_tecnica ?? true,
          sena_abonada: t.sena_abonada ?? true,
          aprobado_jefe: t.aprobado_jefe ?? true,
          medidas_corregidas: t.medidas_corregidas ?? true
        }));
        setTrabajos(soloPendientes as TrabajoPendiente[]);
      })
      .catch(() => {
        if (!mounted) return;
        setTrabajos([]);
        setError("No se pudo cargar desde backend");
      })
      .finally(() => {
        if (!mounted) return;
        setCargando(false);
      });
    return () => { mounted = false; };
  };


  const handleCrearLote = async (grupoKey: string, trabajos: TrabajoPendiente[]) => {
    if (!confirm(`¿Crear lote de producción para ${grupoKey} con ${trabajos.length} trabajos?`)) return;
    try {
      const materialId = trabajos[0].material;
      const ids = trabajos.map(t => t.id);
      await crearAcumulado({
        nombre: `Lote ${grupoKey} - ${new Date().toLocaleDateString()}`,
        material_id: materialId,
        trabajos_ids: ids
      });
      toast.success("Lote creado correctamente");
      recargarAcumulados();
      recargarTrabajos();
    } catch (e: any) {
      toast.error(e.message || "Error al crear lote");
    }
  };

  const handleGenerarPlan = async (id: string) => {
    try {
      toast.info("Generando plan de corte...");
      await generarPlanAcumulado(id);
      toast.success("Plan generado correctamente");
      recargarAcumulados();
    } catch (e: any) {
      toast.error(e.message || "Error al generar plan");
    }
  };

  const handleAprobarPlan = async (id: string) => {
    if (!confirm("¿Aprobar plan y enviar a corte? Esto cambiará el estado de los trabajos.")) return;
    try {
      await aprobarPlanAcumulado(id);
      toast.success("Plan aprobado y enviado a corte");
      recargarAcumulados();
      recargarTrabajos();
    } catch (e: any) {
      toast.error(e.message || "Error al aprobar plan");
    }
  };

  useEffect(() => {
    const cleanup = recargarTrabajos();
    recargarAcumulados();
    return cleanup;
  }, []);

  const validarRequisito = async (trabajo: TrabajoPendiente, tipo: 'visita' | 'sena' | 'aprobacion') => {
    // Validaciones preventivas frontend
    if (tipo === 'visita') {
      if (!trabajo.sena_abonada) {
        toast.error("No se puede validar visita sin haber validado el Pago (Seña).");
        return;
      }
      // Nota: medidas_corregidas suele ser manejado por RevisionTecnica, 
      // pero si el usuario quiere "todo aprobado", forzamos que sepa que falta algo si no está.
      if (!trabajo.medidas_corregidas) {
        toast.error("No se puede marcar la Visita como Completa si no se han guardado las Medidas Definitivas.");
        return;
      }
    }

    if (tipo === 'aprobacion') {
      if (!trabajo.visita_tecnica) {
        toast.error("Requisito faltante: Visita Técnica no realizada.");
        return;
      }
    }

    try {
      await post(`/api/trabajos/${trabajo.id}/validar/${tipo}`, {});
      toast.success(`Requisito ${tipo} validado correctamente`);
      recargarTrabajos();
    } catch (e: any) {
      toast.error(e.message || `Error al validar ${tipo}`);
    }
  };

  const toggleSeleccionPieza = (trabajoId: string, piezaIdx: number) => {
    const key = `${trabajoId}-${piezaIdx}`;
    const newSet = new Set(piezasSeleccionadas);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setPiezasSeleccionadas(newSet);
  };

  const marcarComoOkay = async (trabajoId: string, piezaId: string) => {
    if (!confirm("¿Marcar esta pieza como cortada y terminada?")) return;

    try {
      await post(`/api/trabajos/${trabajoId}/piezas/${piezaId}/estado`, { estado: 'cortada' });
      toast.success("Pieza marcada como cortada");
      setPiezasCortadas(prev => new Set([...prev, `${trabajoId}-${piezaId}`]));
      recargarTrabajos();
    } catch (e: unknown) {
      const error = e as Error;
      toast.error(error.message || "Error al marcar pieza");
    }
  };

  const marcarSeleccionadasComoCortadas = async () => {
    if (piezasSeleccionadas.size === 0) {
      toast.error("Selecciona al menos una pieza");
      return;
    }

    if (!confirm(`¿Marcar ${piezasSeleccionadas.size} pieza(s) como cortadas?`)) return;

    try {
      const promises = Array.from(piezasSeleccionadas).map(async (key) => {
        const [trabajoId, piezaIdx] = key.split('-');
        const trabajo = trabajos.find(t => t.id === trabajoId);
        if (!trabajo) return;

        const piezas = trabajo.piezas_data || trabajo.piezas || [];
        const pieza = piezas[parseInt(piezaIdx)];
        if (!pieza?.id) return;

        await post(`/api/trabajos/${trabajoId}/piezas/${pieza.id}/estado`, { estado: 'cortada' });
      });

      await Promise.all(promises);
      toast.success(`${piezasSeleccionadas.size} pieza(s) marcadas como cortadas`);
      setPiezasSeleccionadas(new Set());
      recargarTrabajos();
    } catch (e: unknown) {
      const error = e as Error;
      toast.error(error.message || "Error al marcar piezas");
    }
  };

  const calcularPrecioPieza = (pieza: Pieza, precioM2: number = 15000): string => {
    const largo = (pieza.h || pieza.largo || 0) / 100; // cm to m
    const ancho = (pieza.w || pieza.ancho || 0) / 100; // cm to m
    const area = largo * ancho;
    const cantidad = pieza.qty || pieza.cantidad || 1;
    const precioTotal = area * precioM2 * cantidad;
    return `$${Math.round(precioTotal).toLocaleString('es-AR')}`;
  };

  const StatusIndicator = ({ ok, label, onClick }: { ok?: boolean; label: string; onClick?: () => void }) => (
    <div
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer hover:bg-muted/50 ${ok ? "text-green-700 border-green-200 bg-green-50" : "text-red-700 border-red-200 bg-red-50"}`}
      onClick={onClick}
      title={ok ? `${label}: OK` : `${label}: Pendiente (Click para validar)`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      <span>{label}</span>
    </div>
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return trabajos.filter(
      (t) => {
        const matchesSearch = !q ||
          t.id.toLowerCase().includes(q) ||
          t.cliente.toLowerCase().includes(q) ||
          t.material.toLowerCase().includes(q) ||
          t.color.toLowerCase().includes(q);

        const matchesPrioridad = filtroPrioridad === "todas" || t.prioridad === filtroPrioridad;
        const matchesMaterial = filtroMaterial === "todos" || t.material === filtroMaterial;
        const matchesEstado = filtroEstado === "todos" || t.estado === filtroEstado;

        let matchesDate = true;
        if (dateRange?.from) {
          if (!t.fecha_creacion) {
            matchesDate = false;
          } else {
            const fechaTrabajo = new Date(t.fecha_creacion);
            const start = startOfDay(dateRange.from!);
            const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from!);
            matchesDate = isWithinInterval(fechaTrabajo, { start, end });
          }
        }

        return matchesSearch && matchesPrioridad && matchesMaterial && matchesDate && matchesEstado;
      }
    );
  }, [busqueda, trabajos, filtroPrioridad, filtroMaterial, dateRange, filtroEstado]);

  const materialesDisponibles = useMemo(() => {
    const mats = new Set(trabajos.map(t => t.material));
    return Array.from(mats);
  }, [trabajos]);

  const grupos = useMemo(() => {
    return groupTrabajos(filtrados, claveGrupo);
  }, [filtrados, claveGrupo]);

  const totalTrabajos = filtrados.length;
  const totalPiezas = filtrados.reduce(
    (s, t) => s + (Array.isArray(t.piezas) ? t.piezas : []).reduce((sp, p) => sp + (Number(p.cantidad) || 0), 0),
    0
  );
  const totalArea = filtrados.reduce((s, t) => s + totalAreaTrabajo(t), 0);

  // Calcular piezas seleccionadas con toda su información para el preview
  const piezasSeleccionadasData = useMemo(() => {
    const piezasData: Array<Pieza & { trabajoId: string; idx: number }> = [];
    Array.from(piezasSeleccionadas).forEach((key) => {
      const [trabajoId, piezaIdx] = key.split('-');
      const trabajo = trabajos.find(t => t.id === trabajoId);
      if (!trabajo) return;

      const piezas = trabajo.piezas_data || trabajo.piezas || [];
      const pieza = piezas[parseInt(piezaIdx)];
      if (pieza) {
        piezasData.push({
          ...pieza,
          trabajoId,
          idx: parseInt(piezaIdx)
        });
      }
    });
    return piezasData;
  }, [piezasSeleccionadas, trabajos]);

  const handleRemovePiezaFromSelection = (key: string) => {
    const newSelection = new Set(piezasSeleccionadas);
    newSelection.delete(key);
    setPiezasSeleccionadas(newSelection);
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-gray-900 mb-2">Lista de Pendientes</h1>
        <p className="text-gray-600">
          Agrupa trabajos por mismo mármol para optimizar el uso de planchas y
          reducir desperdicios.
        </p>
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          <Card>
            <CardContent className="py-4 grid md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary">Trabajos</Badge>
                <span className="text-lg">{totalTrabajos}</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">Piezas</Badge>
                <span className="text-lg">{totalPiezas}</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">Área total</Badge>
                <span className="text-lg">{(totalArea / 10000).toFixed(2)} m²</span>
              </div>
            </CardContent>
          </Card>

          <Separator className="my-6" />

          <Tabs defaultValue="agrupar" className="space-y-6 flex-1">
            <div className="flex justify-between items-center">
              <TabsList>
                <TabsTrigger value="agrupar">Agrupar</TabsTrigger>
                <TabsTrigger value="planes">Planes de Corte</TabsTrigger>
                <TabsTrigger value="todos">Todos</TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                {piezasSeleccionadas.size > 0 && (
                  <Button
                    onClick={marcarSeleccionadasComoCortadas}
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="mr-2 h-4 w-4" /> Marcar {piezasSeleccionadas.size} como cortadas
                  </Button>
                )}
                <Button
                  onClick={() => setMostrarCortadas(!mostrarCortadas)}
                  variant="outline"
                  title={mostrarCortadas ? "Ocultar piezas cortadas" : "Mostrar piezas cortadas"}
                >
                  <Eye className="mr-2 h-4 w-4" /> {mostrarCortadas ? "Ocultar" : "Ver"} Cortadas
                </Button>
                <Button onClick={() => setDxfDialogOpen(true)} variant="outline">
                  <Upload className="mr-2 h-4 w-4" /> Analizar DXF
                </Button>
                <Button onClick={recargarTrabajos} variant="outline" size="icon" title="Recargar trabajos">
                  <RotateCcw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            <TabsContent value="agrupar" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración de agrupado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <span className="text-sm text-muted-foreground mr-2">Agrupar por:</span>
                    <Button
                      variant={claveGrupo === "material" ? "default" : "outline"}
                      onClick={() => setClaveGrupo("material")}
                      size="sm"
                    >
                      Por material
                    </Button>
                    <Button
                      variant={claveGrupo === "material_color" ? "default" : "outline"}
                      onClick={() => setClaveGrupo("material_color")}
                      size="sm"
                    >
                      Por color
                    </Button>
                    {SYSTEM_CONFIG.showThicknessInApproval && (
                      <Button
                        variant={claveGrupo === "espesor" ? "default" : "outline"}
                        onClick={() => setClaveGrupo("espesor")}
                        size="sm"
                      >
                        Por espesor
                      </Button>
                    )}
                  </div>
                  {cargando && <div className="text-sm text-muted-foreground">Cargando desde backend…</div>}
                  {error && <div className="text-sm text-red-600">{error}</div>}
                </CardContent>
              </Card>

              {grupos.map((g) => {
                const allValid = g.trabajos.every(t => t.visita_tecnica && t.aprobado_jefe && t.sena_abonada);
                return (
                  <Card key={g.key} className={allValid ? "border-green-200 bg-green-50/10" : ""}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle>{g.key}</CardTitle>
                          {!allValid && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{g.trabajos.length} trabajos</Badge>
                          <Badge variant="secondary">{g.totalPiezas} piezas</Badge>
                          <Badge variant="secondary">{(g.totalArea / 10000).toFixed(2)} m²</Badge>
                          <Button
                            onClick={() => {
                              if (!allValid) {
                                toast.error("Algunos trabajos no cumplen la Regla de Oro (Visita + Seña + Aprobación)");
                                // return; // Uncomment to strict block in UI too
                              }
                              imprimirPlanDeCorte(g.trabajos.map(t => t.id), g.key, g.trabajos[0]?.material);
                            }}
                            variant="outline"
                            size="sm"
                            title="Imprimir plan de corte real desde el backend"
                          >
                            <Printer className="h-4 w-4 mr-2" /> Imprimir Plan
                          </Button>
                          <Button
                            onClick={() => {
                              if (!allValid) {
                                toast.error("Algunos trabajos no cumplen la Regla de Oro (Visita + Seña + Aprobación)");
                                // return; // Uncomment to strict block in UI too
                              }
                              const piezas: Pieza[] = g.trabajos.flatMap((t) => t.piezas);
                              setDialogData({ key: g.key, piezas, material: g.trabajos[0]?.material || "Plancha", trabajos: g.trabajos });
                              setOpenDialog(true);
                            }}
                            variant={allValid ? "default" : "secondary"}
                          >
                            {allValid ? "Crear lote" : "Ver lote (Incompleto)"}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {g.trabajos.map((t) => (
                        <div key={t.id} className="border rounded-lg p-4 bg-background">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium">{t.cliente} · {t.id}</h3>
                              <p className="text-sm text-muted-foreground">
                                {t.material} · {t.color}
                                {SYSTEM_CONFIG.showThicknessInApproval ? ` · ${t.espesor} mm` : ''}
                                {t.fecha && <span className="ml-2 text-xs opacity-70">({new Date(t.fecha).toLocaleDateString()})</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => eliminarTrabajo(t.id)}
                                title="Eliminar trabajo"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Badge variant={t.prioridad === "alta" ? "default" : "secondary"}>{t.prioridad}</Badge>
                              <Badge variant="outline">{(totalAreaTrabajo(t) / 10000).toFixed(2)} m²</Badge>
                            </div>
                          </div>

                          <div className="flex gap-2 mt-3 mb-3">
                            <StatusIndicator ok={t.visita_tecnica} label="Visita" onClick={() => !t.visita_tecnica && validarRequisito(t, 'visita')} />
                            <StatusIndicator ok={t.sena_abonada} label="Seña" onClick={() => !t.sena_abonada && validarRequisito(t, 'sena')} />
                            <StatusIndicator ok={t.aprobado_jefe} label="Aprobación" onClick={() => !t.aprobado_jefe && validarRequisito(t, 'aprobacion')} />
                          </div>

                          <Separator className="my-3" />
                          <div className="grid md:grid-cols-3 gap-3">
                            {(t.piezas_data || (Array.isArray(t.piezas) ? t.piezas : [])).map((p, idx) => (
                              <div key={idx} className="border rounded-lg p-3 bg-muted/20">
                                <div className="text-sm font-medium">{p.largo} × {p.ancho} cm</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Área: {(areaPieza(p) / 10000).toFixed(2)} m²
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <Button size="sm" variant="outline" className="text-xs"
                                    onClick={() => p.id && marcarComoOkay(t.id, p.id)}>
                                    <Check className="h-3 w-3 mr-1" /> Corte OK
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-xs"
                                    onClick={() => imprimirEtiquetaPieza(t, p, idx)}>
                                    <Printer className="h-3 w-3 mr-1" /> Etiqueta
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )
              })}
            </TabsContent>

            <TabsContent value="planes" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {acumulados.map(acum => (
                  <Card key={acum.id} className="overflow-hidden">
                    <CardHeader className="bg-gray-50 pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{acum.nombre}</CardTitle>
                        <Badge variant={acum.estado === 'optimizado' ? 'default' : (acum.estado === 'listo_para_corte' ? 'secondary' : 'outline')}>
                          {acum.estado}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(acum.fecha_creacion).toLocaleDateString()}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex justify-between text-sm">
                        <span>Material:</span>
                        <span className="font-medium">{acum.material_nombre || acum.material_id}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Trabajos:</span>
                        <span className="font-medium">{acum.trabajos_ids.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Utilización:</span>
                        <span className="font-medium">{acum.utilization ? `${(acum.utilization * 100).toFixed(1)}%` : (acum.m2_actuales ? `${(acum.m2_actuales / acum.capacidad_m2 * 100).toFixed(1)}%` : '-')}</span>
                      </div>

                      {acum.plan_img_url && (
                        <div className="mt-2 border rounded overflow-hidden bg-white">
                          <img src={acum.plan_img_url} alt="Plan de corte" className="w-full h-auto object-contain max-h-48" />
                        </div>
                      )}

                      <div className="flex gap-2 mt-4">
                        {acum.estado === 'pendiente' && (
                          <Button className="w-full" onClick={() => handleGenerarPlan(acum.id)}>
                            <Play className="w-4 h-4 mr-2" /> Generar Plan
                          </Button>
                        )}
                        {(acum.estado === 'optimizado' || acum.estado === 'listo_para_corte') && (
                          <>
                            <Button variant="outline" className="flex-1" onClick={() => acum.plan_img_url && window.open(acum.plan_img_url, '_blank')} title="Ver Plan">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {acum.plan_dxf_url && (
                              <Button variant="outline" className="flex-1" onClick={() => acum.plan_dxf_url && window.open(acum.plan_dxf_url, '_blank')} title="Descargar DXF">
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                            {acum.estado === 'optimizado' && (
                              <Button className="flex-1" onClick={() => handleAprobarPlan(acum.id)}>
                                <Check className="w-4 h-4 mr-2" /> Aprobar
                              </Button>
                            )}
                          </>
                        )}
                        {acum.estado === 'listo_para_corte' && (
                          <Button variant="secondary" className="flex-1" disabled>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Aprobado
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {acumulados.length === 0 && (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    No hay lotes de producción creados. Agrupa trabajos para comenzar.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="todos" className="space-y-4">
              {filtrados.map((t) => (
                <Card key={t.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{t.cliente} · {t.id}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => eliminarTrabajo(t.id)}
                        title="Eliminar trabajo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary">{t.material}</Badge>
                      <Badge variant="secondary">{t.color}</Badge>
                      {SYSTEM_CONFIG.showThicknessInApproval && <Badge variant="secondary">{t.espesor} mm</Badge>}
                      <Badge variant="outline">{(totalAreaTrabajo(t) / 10000).toFixed(2)} m²</Badge>
                    </div>

                    <div className="flex gap-2 mb-4">
                      <StatusIndicator ok={t.visita_tecnica} label="Visita" onClick={() => !t.visita_tecnica && validarRequisito(t, 'visita')} />
                      <StatusIndicator ok={t.sena_abonada} label="Seña" onClick={() => !t.sena_abonada && validarRequisito(t, 'sena')} />
                      <StatusIndicator ok={t.aprobado_jefe} label="Aprobación" onClick={() => !t.aprobado_jefe && validarRequisito(t, 'aprobacion')} />
                    </div>

                    <div className="grid md:grid-cols-3 gap-3">
                      {(t.piezas_data || (Array.isArray(t.piezas) ? t.piezas : [])).map((p, idx) => (
                        <div key={idx} className="border rounded-lg p-2 bg-muted/20 text-sm">
                          <div className="font-medium">{p.largo} × {p.ancho} cm</div>
                          <div className="text-xs text-muted-foreground">{(areaPieza(p) / 10000).toFixed(2)} m²</div>
                          <div className="flex gap-1 mt-2">
                            <Button size="sm" variant="outline" className="text-xs h-7"
                              onClick={() => p.id && marcarComoOkay(t.id, p.id)}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs h-7"
                              onClick={() => imprimirEtiquetaPieza(t, p, idx)}>
                              <Printer className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>

      </div>

      <DialogDXF open={dxfDialogOpen} onOpenChange={setDxfDialogOpen} />

      <DialogPlanCorte
        open={openDialog}
        onOpenChange={setOpenDialog}
        dialogData={dialogData}
        onCrearLote={handleCrearLote}
        onEliminarTrabajo={eliminarTrabajo}
        grupos={grupos}
        setDialogData={setDialogData}
      />
    </div>
  );
}