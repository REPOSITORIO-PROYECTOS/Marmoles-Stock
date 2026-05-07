import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import {
  MapPin,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Download,
  FileCode,
  Eye,
} from 'lucide-react';
import { patch, post, get, del } from '../../api';
import { FileUpload } from '../../components/common/FileUpload';
import { procesarDxf } from '../../lib/produccion/plan';
import {
  buildPiezasFromDxfResult,
  buildPiezasFromPresupuesto,
  type VisitaPiezaBulkItem,
} from '../../lib/produccion/n12VisitaPiezas';
import { generatePlanImage } from '../../utils/planImage';
import { toast } from 'sonner';
import {
  imprimirPresupuestoArgentino,
  previsualizarPresupuestoArgentino,
  type DatosPresupuesto,
} from '../../utils/presupuestoExporter';
import { savePlanoTecnicoLandscapePdf } from '../../utils/planoTecnicoPdfExport';
import {
  presupuestoApiToDatosPresupuesto,
  type PresupuestoApiPayload,
} from '../../utils/presupuestoRenderer';

interface OrdenVisitaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trabajoId: string | null;
  presupuestoId: string;
  clienteNombre: string;
  direccion?: string;
  coordenadas?: string;
  material?: string;
  visitaRealizada?: boolean;
  aprobadoJefe?: boolean;
  mode?: 'finanzas' | 'produccion';
  onSuccess: () => void;
}

export function OrdenVisitaDialog({
  open,
  onOpenChange,
  trabajoId,
  presupuestoId,
  clienteNombre,
  direccion,
  coordenadas,
  material,
  visitaRealizada,
  aprobadoJefe,
  mode = 'produccion',
  onSuccess
}: OrdenVisitaDialogProps) {
  const N12_VISITA_MODE = true;
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [fecha, setFecha] = useState('');
  const [notas, setNotas] = useState('');
  const [medidasCorregidas, setMedidasCorregidas] = useState(false);
  const [jobDetails, setJobDetails] = useState<any>(null);
  const [compuertas, setCompuertas] = useState<{
    visita_tecnica: boolean;
    medidas_corregidas: boolean;
    aprobado_jefe: boolean;
    sena_abonada: boolean;
    cancelacion_solicitada: boolean;
  } | null>(null);
  const [dxfProcessing, setDxfProcessing] = useState(false);
  const [revisionesPlano, setRevisionesPlano] = useState<any[]>([]);
  const [planoInfo, setPlanoInfo] = useState<any>(null);
  const [visitaN12Id, setVisitaN12Id] = useState<string | null>(null);
  const [visitaN12Estado, setVisitaN12Estado] = useState<string | null>(null);
  const [visitaCompuertaMsg, setVisitaCompuertaMsg] = useState<string | null>(null);
  const [presupuestoData, setPresupuestoData] = useState<any>(null);
  const [piezasN12Count, setPiezasN12Count] = useState(0);
  const isFinanzas = mode === 'finanzas';
  const visitaRealizadaFinal =
    (visitaRealizada ?? Boolean(jobDetails?.trabajo?.visita_tecnica)) ||
    visitaN12Estado === 'completada';
  const aprobadoJefeFinal = N12_VISITA_MODE
    ? visitaRealizadaFinal
    : (aprobadoJefe ?? Boolean(jobDetails?.trabajo?.aprobado_jefe));

  // Cargar datos si ya existen
  useEffect(() => {
    if (open && trabajoId && !isFinanzas) {
      fetchJobDetails();
    }
    if (open && presupuestoId) {
      fetchVisitaN12();
      fetchPresupuesto();
    }
  }, [open, trabajoId, presupuestoId, isFinanzas]);

  const fetchPresupuesto = async () => {
    try {
      const presupuesto = await get<any>(`/api/presupuestos/${presupuestoId}`);
      setPresupuestoData(presupuesto);
    } catch {
      setPresupuestoData(null);
    }
  };

  const refreshVisitaN12Detail = async (visitaId: string) => {
    try {
      const d = await get<{ piezas_count?: number }>(`/api/n12/visitas/${visitaId}`);
      setPiezasN12Count(Number(d?.piezas_count ?? 0));
    } catch {
      setPiezasN12Count(0);
    }
  };

  const fetchVisitaN12 = async () => {
    try {
      const gate = await get<{ habilitada: boolean; motivo?: string | null }>(`/api/n12/visitas/compuerta/${presupuestoId}`);
      setVisitaCompuertaMsg(gate?.habilitada ? null : (gate?.motivo || "Visita bloqueada por compuerta financiera."));
      const visitas = await get<Array<{ id_visita: string; fecha?: string; estado?: string }>>(`/api/n12/visitas?presupuesto_id=${presupuestoId}`);
      if (Array.isArray(visitas) && visitas.length > 0) {
        const visita = visitas[0];
        setVisitaN12Id(visita.id_visita);
        setVisitaN12Estado(visita.estado || null);
        if (visita.fecha) setFecha(visita.fecha.split("T")[0]);
        await refreshVisitaN12Detail(visita.id_visita);
      } else {
        setVisitaN12Id(null);
        setVisitaN12Estado(null);
        setPiezasN12Count(0);
      }
    } catch (error) {
      console.error(error);
      setVisitaCompuertaMsg("No se pudo validar compuerta de visita.");
      setVisitaN12Id(null);
      setPiezasN12Count(0);
    }
  };

  const ensureVisitaN12Id = async (): Promise<string | null> => {
    if (visitaCompuertaMsg) {
      toast.error("Visita bloqueada por compuerta financiera.");
      return null;
    }
    if (visitaN12Id) return visitaN12Id;
    const fechaProg = fecha || new Date().toISOString().split("T")[0];
    const created = await post<{ id_visita: string }>(`/api/n12/visitas`, {
      presupuesto_id: presupuestoId,
      fecha_programada: fechaProg,
      observaciones: notas || undefined,
    });
    const id = created?.id_visita || null;
    if (id) {
      setVisitaN12Id(id);
      setVisitaN12Estado("pendiente");
      await patch(`/api/n12/visitas/${id}`, {
        fecha: fechaProg,
        estado: "programada",
        observaciones: notas,
      });
      setVisitaN12Estado("programada");
    }
    return id;
  };

  const replaceVisitaPiezasN12 = async (piezas: VisitaPiezaBulkItem[]) => {
    if (piezas.length === 0) {
      toast.error("No se detectaron piezas válidas para guardar en la visita N12.");
      return;
    }
    const vid = await ensureVisitaN12Id();
    if (!vid) return;
    try {
      const visitaActual = await get<{ estado?: string }>(`/api/n12/visitas/${vid}`);
      if (visitaActual?.estado === "completada") {
        toast.error("La visita ya está completada; no se pueden reemplazar piezas.");
        return;
      }
    } catch {
      toast.error("No se pudo validar el estado de la visita.");
      return;
    }
    await del(`/api/n12/visitas/${vid}/piezas`);
    await post(`/api/n12/visitas/${vid}/piezas/bulk`, { piezas });
    await refreshVisitaN12Detail(vid);
    toast.success(`${piezas.length} pieza(s) guardadas en visita N12`);
  };

  const fetchJobDetails = async () => {
    setLoadingDetails(true);
    try {
      const data = await get<any>(`/api/trabajos/${trabajoId}/detalle`);
      setJobDetails(data);
      if (data.trabajo.fecha_visita_sugerida) {
        setFecha(data.trabajo.fecha_visita_sugerida.split('T')[0]);
      }
      if (data.trabajo.notas_tecnicas) {
        setNotas(data.trabajo.notas_tecnicas);
      }
      if (data.trabajo.medidas_corregidas) {
        setMedidasCorregidas(true);
      }
      if (trabajoId) {
        try {
          const gates = await get<any>(`/api/trabajos/${trabajoId}/compuertas`);
          setCompuertas(gates);
        } catch {
          setCompuertas(null);
        }
      }
      // Cargar revisiones de planos técnicos del cliente
      const clienteId = data?.cliente?.id;
      if (clienteId) {
        try {
          const planos = await get<any[]>(`/api/planos-tecnicos?cliente_id=${clienteId}`);
          const ultimo = Array.isArray(planos) && planos.length > 0 ? planos[0] : null;
          if (ultimo?.id) {
            const detallePlano = await get<any>(`/api/planos-tecnicos/${ultimo.id}`);
            setPlanoInfo(detallePlano);
            setRevisionesPlano(Array.isArray(detallePlano?.revisiones) ? detallePlano.revisiones : []);
          } else {
            setPlanoInfo(null);
            setRevisionesPlano([]);
          }
        } catch {
          setPlanoInfo(null);
          setRevisionesPlano([]);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar detalles del trabajo");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleMarcarVisitaRealizada = async () => {
    if (!visitaN12Id) return;
    setLoading(true);
    try {
      if (visitaN12Id) {
        await post(`/api/n12/visitas/${visitaN12Id}/cerrar`, {});
        setVisitaN12Estado("completada");
      }
      if (!N12_VISITA_MODE && trabajoId) {
        await post(`/api/trabajos/${trabajoId}/validar/visita`, {});
      }
      toast.success("Visita marcada como realizada");
      await fetchJobDetails();
      await fetchVisitaN12();
    } catch (error) {
      toast.error("No se pudo cerrar la visita. Verifique compuerta financiera y carga de piezas en mm.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarVisita = async () => {
    // Validar fecha si es la primera vez (no realizada) o si se está intentando agendar
    if (!visitaRealizadaFinal && !fecha) {
      toast.error("Debe indicar una fecha sugerida para la visita");
      return;
    }

    setLoading(true);
    try {
      let targetVisitaId = visitaN12Id;
      if (!targetVisitaId) {
        const created = await post<{ id_visita: string }>(`/api/n12/visitas`, {
          presupuesto_id: presupuestoId,
          fecha_programada: fecha,
          observaciones: notas || undefined,
        });
        targetVisitaId = created?.id_visita || null;
        setVisitaN12Id(targetVisitaId);
        setVisitaN12Estado("pendiente");
      }
      if (targetVisitaId) {
        await patch(`/api/n12/visitas/${targetVisitaId}`, {
          fecha,
          estado: "programada",
          observaciones: notas,
        });
        setVisitaN12Estado("programada");
      }
      if (!N12_VISITA_MODE && trabajoId) {
        await patch(`/api/trabajos/${trabajoId}/visita`, {
        fecha_visita_sugerida: fecha,
        notas_tecnicas: notas
        });
      }

      toast.success("Orden de Visita actualizada correctamente");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar la orden de visita");
    } finally {
      setLoading(false);
    }
  };

  const handleAprobarJefe = async () => {
    if (!trabajoId) return;
    if (N12_VISITA_MODE) {
      toast.info("En modo N12, la visita completada queda habilitada sin aprobación manual separada.");
      return;
    }

    // Validación de requisitos ANTES de intentar aprobación
    const requisitos = jobDetails?.trabajo || {};
    const falta = [];

    if (!requisitos.visita_tecnica) {
      falta.push("Visita Técnica no realizada");
    }
    if (!requisitos.medidas_corregidas) {
      falta.push("Medidas reales no confirmadas");
    }
    if (!requisitos.sena_abonada) {
      falta.push("Seña no confirmada");
    }

    if (falta.length > 0) {
      toast.error(`No se puede aprobar.\n\nFalta: ${falta.join(', ')}\n\nRealice primero estos pasos.`);
      return;
    }

    setLoading(true);
    try {
      // PASO 0: Aceptar presupuesto si no está aceptado
      try {
        await post<any>(`/api/presupuestos/${presupuestoId}/aceptar`, {});
      } catch (e) {
        // Si ya estaba aceptado, ignorar el error
      }

      const response = await post<any>(`/api/trabajos/${trabajoId}/validar/aprobacion`, {});

      // Generar/Activar Orden de Trabajo automáticamente al aprobar
      let targetTrabajoId = trabajoId;
      if (!targetTrabajoId) {
        try {
          const res = await post<any>(`/api/trabajos/desde-presupuesto/${presupuestoId}`, {});
          targetTrabajoId = res?.id;
        } catch (e: any) {
          // Si ya existe el trabajo, intentar obtenerlo
          console.warn('No se pudo crear trabajo:', e);
        }
      }
      if (targetTrabajoId) {
        try {
          await post(`/api/produccion/orden/${targetTrabajoId}/actualizar-estado`, {
            nuevo_estado: 'planificacion'
          });
        } catch {
          // No es crítico si falla este paso
        }
      }

      const mensaje = response?.mensaje || "Aprobación registrada. Ingresará a producción cuando la seña sea abonada.";
      toast.success(mensaje);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      const errorMsg = error?.detail || "Error al aprobar";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarPlanoSolo = async () => {
    const p = presupuestoData || jobDetails?.presupuesto;
    if (!p) return;

    const anexosImagenes: string[] = [];
    if (Array.isArray(p.lineas)) {
      for (const l of p.lineas) {
        if (l.geometria_json) {
          try {
            const geo = JSON.parse(l.geometria_json);
            const board = geo.boardConfig || geo.effective_board || { width: 300, height: 180 };
            const plan = {
              effective_board: { width: board.width, height: board.height },
              placements: geo.placements || [],
              cuts: [],
              features: geo.features || []
            };
            const img = generatePlanImage(plan);
            if (img) anexosImagenes.push(img);
          } catch { /* noop */ }
        }
      }
    }

    try {
      await savePlanoTecnicoLandscapePdf({
        anexosImagenes,
        cliente: {
          clienteNombre,
          direccion,
          coordenadas,
          material,
        },
        fileBaseName: `Plano_${presupuestoId.slice(0, 8)}`,
      });
      toast.success('Plano técnico descargado (solo medidas)');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo generar el PDF del plano');
    }
  };

  const buildDatosPresupuestoParaPdf = (): DatosPresupuesto | null => {
    const p = (presupuestoData || jobDetails?.presupuesto) as PresupuestoApiPayload;
    if (!p) return null;

    const linkUbicacion = coordenadas
      ? `https://www.google.com/maps?q=${coordenadas.replace(/\s/g, '')}`
      : undefined;

    const correlativo = Number(
      (p as any).correlativo_global ?? p.meta?.correlativo_global ?? 0,
    );
    const correlativoText = correlativo > 0 ? String(correlativo).padStart(6, '0') : '000000';
    const clienteFile = (clienteNombre || 'Cliente')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '');
    const nombreArchivo = `${clienteFile} - ${correlativoText}.pdf`;

    return presupuestoApiToDatosPresupuesto(p, {
      cliente: {
        nombre: clienteNombre,
        dni_cuit: '',
        direccion: direccion || '',
        telefono: '',
        condicionIva: 'Consumidor Final',
      },
      linkUbicacion,
      fecha: new Date().toLocaleDateString(),
      nombreArchivo,
      docId: `P-${p.id.slice(0, 6)}`,
    });
  };

  const handleVistaPreviaPresupuesto = async () => {
    const datos = buildDatosPresupuestoParaPdf();
    if (!datos) return;
    await previsualizarPresupuestoArgentino(datos);
  };

  const handleDescargarPDF = async () => {
    const datos = buildDatosPresupuestoParaPdf();
    if (!datos) return;
    await imprimirPresupuestoArgentino(datos);
  };

  const handleDescargarDWG = () => {
    const dxfUrl = jobDetails?.dxf_url || presupuestoData?.dxf_url;
    if (dxfUrl) {
      const url = dxfUrl.startsWith('http')
        ? dxfUrl
        : `${window.location.origin}${dxfUrl}`;
      window.open(url, '_blank');
    } else {
      toast.error("No hay archivo DWG asociado a este presupuesto");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <Calendar className="h-6 w-6 text-blue-600" />
            Orden de Visita Técnica
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detalle de la orden con acciones para descargar archivos y registrar información de visita.
          </DialogDescription>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="font-mono">#{presupuestoId.slice(0, 8)}</Badge>
            <span className="text-gray-500 font-medium">{clienteNombre}</span>
          </div>
        </DialogHeader>

        {loadingDetails ? (
          <div className="p-8 text-center text-gray-500">Cargando detalles...</div>
        ) : (
          <div className="grid gap-6 py-4">

            {/* BARRA DE DESCARGAS - Solo en Producción */}
            {!isFinanzas && (
              <div className="space-y-3">
                {visitaCompuertaMsg && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {visitaCompuertaMsg}
                  </div>
                )}
                {!isFinanzas && visitaN12Id && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                    Visita N12: piezas estructuradas cargadas: <strong>{piezasN12Count}</strong>
                    {piezasN12Count === 0 && (
                      <span className="block text-amber-700 mt-1">
                        Debe cargar medidas (presupuesto o DXF) antes de cerrar la visita.
                      </span>
                    )}
                  </div>
                )}
                <div className="flex gap-2 bg-linear-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-blue-900 mb-3">Descargas Disponibles</h4>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDescargarPlanoSolo}
                        className="gap-2 text-blue-700 bg-white border-blue-300 hover:bg-blue-50"
                      >
                        <FileText className="h-4 w-4 text-green-600" />
                        <span className="font-semibold">Plano + Largo y Ancho</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleVistaPreviaPresupuesto}
                        className="gap-2 text-slate-700 bg-white border-slate-300 hover:bg-slate-50"
                      >
                        <Eye className="h-4 w-4 text-slate-600" />
                        Vista previa PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDescargarPDF}
                        className="gap-2 text-purple-700 bg-white border-purple-300 hover:bg-purple-50"
                      >
                        <FileText className="h-4 w-4 text-purple-600" />
                        Presupuesto Completo
                      </Button>
                        <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDescargarDWG}
                          disabled={!jobDetails?.dxf_url && !presupuestoData?.dxf_url}
                        className="gap-2 text-blue-700 bg-white border-blue-300 hover:bg-blue-50"
                      >
                        <FileCode className="h-4 w-4 text-blue-600" />
                        DWG Original
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!isFinanzas && planoInfo && (
              <div className="grid gap-3 bg-white p-3 rounded-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700">
                    Plano Técnico: {planoInfo?.nombre || 'Sin nombre'}
                  </div>
                  {planoInfo?.ultimo_archivo && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-blue-600" onClick={() => window.open(planoInfo.ultimo_archivo, '_blank')}>
                      Ver último archivo <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
                <div className="text-xs text-gray-500">Revisiones subidas</div>
                <div className="grid gap-2">
                  {revisionesPlano.length === 0 ? (
                    <div className="text-xs text-gray-400">No hay revisiones</div>
                  ) : (
                    revisionesPlano.map((rev) => (
                      <div key={rev.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">v{rev.version}</Badge>
                          <span className="text-gray-700">{new Date(rev.fecha_subida).toLocaleString()}</span>
                          {rev.comentarios && <span className="text-gray-500 italic">· {rev.comentarios}</span>}
                        </div>
                        {rev.archivo_url && (
                          <Button variant="link" size="sm" className="h-auto p-0 text-blue-600" onClick={() => window.open(rev.archivo_url, '_blank')}>
                            Descargar <Download className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            {!isFinanzas && (
              <div className="grid gap-3 bg-linear-to-r from-blue-50 to-purple-50 p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-900">Plano Técnico Corregido</h4>
                </div>
                <p className="text-xs text-blue-800">Cargue el archivo DWG de AutoCAD con las medidas corregidas. El sistema extraerá automáticamente las dimensiones.</p>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={async () => {
                      if (!trabajoId) return;
                      try {
                        await patch(`/api/trabajos/${trabajoId}/visita`, {
                          fecha_visita_sugerida: fecha,
                          notas_tecnicas: "Usando medidas del presupuesto",
                          medidas_corregidas: true
                        });
                        setMedidasCorregidas(true);
                        toast.success("Medidas del presupuesto aplicadas");
                        fetchJobDetails();
                        if (N12_VISITA_MODE && presupuestoData) {
                          const vid = await ensureVisitaN12Id();
                          if (!vid) return;
                          const matFallback =
                            (material && material.trim()) ||
                            (typeof presupuestoData?.lineas?.[0]?.material === "string"
                              ? presupuestoData.lineas[0].material
                              : "") ||
                            "Material";
                          const piezas = buildPiezasFromPresupuesto(presupuestoData, vid, matFallback);
                          await replaceVisitaPiezasN12(piezas);
                        }
                      } catch (e) {
                        toast.error("No se pudieron aplicar las medidas del presupuesto");
                      }
                    }}
                  >
                    Usar medidas del presupuesto
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {/* Opción 1: Archivo DWG */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-blue-900">Archivo DWG (AutoCAD) - Recomendado</Label>
                    <div className="flex items-center gap-2 p-3 bg-white rounded border border-blue-200">
                      <Input
                        type="file"
                        accept=".dxf,.dwg"
                        className="flex-1"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !trabajoId) {
                            toast.error("Seleccione un archivo DXF/DWG válido");
                            return;
                          }
                          setDxfProcessing(true);
                          try {
                            const res = await procesarDxf(file);
                            await patch(`/api/trabajos/${trabajoId}/visita`, {
                              fecha_visita_sugerida: fecha,
                              notas_tecnicas: `Plano corregido: ${file.name}`,
                              medidas_corregidas: true,
                              dxf_url: res?.dxf_url
                            });
                            setJobDetails((prev: any) => ({
                              ...prev,
                              dxf_url: res?.dxf_url,
                              img_url: res?.img_url
                            }));
                            if (N12_VISITA_MODE) {
                              const vid = await ensureVisitaN12Id();
                              if (vid) {
                                const matN12 =
                                  (material && material.trim()) ||
                                  (typeof presupuestoData?.lineas?.[0]?.material === "string"
                                    ? presupuestoData.lineas[0].material
                                    : "") ||
                                  "Material";
                                const piezasDxf = buildPiezasFromDxfResult(res, vid, matN12, 20);
                                if (piezasDxf.length > 0) {
                                  await replaceVisitaPiezasN12(piezasDxf);
                                } else {
                                  toast.info(
                                    "DXF procesado; no se detectaron polígonos cerrados para piezas N12. Use medidas del presupuesto o corrija el DXF.",
                                  );
                                }
                              }
                            }
                            toast.success("✓ DWG procesado correctamente. Medidas extraídas.");
                          } catch (err) {
                            console.error(err);
                            toast.error("Error procesando DWG. Verifique que sea un archivo válido.");
                          } finally {
                            setDxfProcessing(false);
                            e.target.value = '';
                          }
                        }}
                        disabled={dxfProcessing}
                      />
                      {dxfProcessing && (
                        <div className="flex items-center gap-2 text-blue-600">
                          <span className="text-xs animate-pulse">Procesando...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Opción 2: Plano en Imagen */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-blue-900">O Plano en Imagen (PDF/JPG)</Label>
                    <FileUpload
                      label="Subir plano como imagen (si no tiene DWG)"
                      accept=".pdf,image/*"
                      onUploadComplete={async (url, filename) => {
                        try {
                          await patch(`/api/trabajos/${trabajoId}/visita`, {
                            fecha_visita_sugerida: fecha,
                            notas_tecnicas: `Plano adjunto: ${filename}`,
                            medidas_corregidas: true
                          });
                          toast.success("✓ Plano corregido adjuntado");
                          fetchJobDetails();
                        } catch (e) {
                          toast.error("No se pudo adjuntar el plano");
                        }
                      }}
                    />
                  </div>

                  {/* Resumen del estado */}
                  {medidasCorregidas && (
                    <div className="flex items-center gap-2 p-2 bg-green-100 rounded border border-green-300 text-green-800 text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Medidas corregidas y plano adjunto</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECCIÓN 1: DATOS DE UBICACIÓN */}
            <div className="space-y-3 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <MapPin className="h-3 w-3" /> Ubicación de Obra
              </h4>
              <div className="grid gap-2">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium text-gray-700">{direccion || 'Dirección no especificada'}</span>
                  {coordenadas && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-blue-600" onClick={() => window.open(`https://www.google.com/maps?q=${coordenadas}`, '_blank')}>
                      Ver en Maps <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Material: <strong>{material}</strong></span>
                  {coordenadas && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Coords: {coordenadas}</span>}
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: PLANIFICACIÓN */}
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha" className="text-xs font-bold uppercase text-gray-500">Fecha Sugerida para Visita</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="fecha"
                    type="date"
                    className="pl-10"
                    value={fecha}
                    onChange={e => setFecha(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: REPORTE TÉCNICO (SOLO PRODUCCIÓN) */}
            {!isFinanzas && (
              <div className="space-y-3 border-t pt-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Reporte del Técnico</h4>
                <div className="space-y-2">
                  <Label htmlFor="notas" className="text-xs font-bold uppercase text-gray-500">Observaciones y Correcciones</Label>
                  <Textarea
                    id="notas"
                    placeholder="Indique corrección de medidas, viabilidad de acceso, o requisitos especiales de instalación..."
                    className="min-h-[100px]"
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded-md border border-blue-100">
                  <input
                    type="checkbox"
                    id="medidas"
                    aria-label="Validar medidas"
                    className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                    checked={medidasCorregidas}
                    onChange={(e) => setMedidasCorregidas(e.target.checked)}
                  />
                  <Label htmlFor="medidas" className="text-sm font-medium text-blue-900 cursor-pointer">
                    ✓ He validado y corregido las medidas reales en obra
                  </Label>
                </div>
                {compuertas && (
                  <div className="grid grid-cols-2 gap-2 text-xs rounded-md border border-slate-200 bg-slate-50 p-2">
                    <div className={compuertas.visita_tecnica ? "text-green-700" : "text-red-700"}>
                      Visita: {compuertas.visita_tecnica ? "OK" : "Pendiente"}
                    </div>
                    <div className={compuertas.medidas_corregidas ? "text-green-700" : "text-red-700"}>
                      Medidas: {compuertas.medidas_corregidas ? "OK" : "Pendiente"}
                    </div>
                    <div className={compuertas.sena_abonada ? "text-green-700" : "text-red-700"}>
                      Seña: {compuertas.sena_abonada ? "OK" : "Pendiente"}
                    </div>
                    <div className={compuertas.aprobado_jefe ? "text-green-700" : "text-amber-700"}>
                      Aprobación: {compuertas.aprobado_jefe ? "OK" : "Pendiente"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ESTADO ACTUAL (SOLO PRODUCCIÓN) */}
            {!isFinanzas && (
              <div className="flex flex-wrap gap-2 pt-2">
                {visitaRealizadaFinal ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> VISITA REALIZADA
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-200">
                    <Clock className="h-3 w-3 mr-1" /> PENDIENTE DE VISITA
                  </Badge>
                )}

                {aprobadoJefeFinal ? (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> APROBADO POR PRODUCCIÓN
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-400 border-gray-200">
                    <AlertCircle className="h-3 w-3 mr-1" /> ESPERANDO APROBACIÓN
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>

          <div className="flex gap-2">
            <Button
              onClick={handleGuardarVisita}
              disabled={loading || !fecha || !!visitaCompuertaMsg}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Guardar Cambios
            </Button>

            {!isFinanzas && !visitaRealizadaFinal && (
              <Button
                onClick={handleMarcarVisitaRealizada}
                disabled={loading || !medidasCorregidas || !!visitaCompuertaMsg}
                title={!medidasCorregidas ? 'Primero valida las medidas marcando el checkbox' : ''}
                className="bg-green-600 hover:bg-green-700"
              >
                Marcar Visita Realizada
              </Button>
            )}

            {!isFinanzas && !N12_VISITA_MODE && visitaRealizadaFinal && !aprobadoJefeFinal && (
              <Button
                onClick={handleAprobarJefe}
                disabled={loading || !medidasCorregidas}
                title={!medidasCorregidas ? 'Las medidas deben estar validadas y corregidas' : ''}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Aprobar Visita (Jefe)
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
