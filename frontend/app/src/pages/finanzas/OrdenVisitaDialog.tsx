import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
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
  CreditCard,
  FileCode,
  Info as InfoIcon,
  Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import { patch, post, get } from '../../api';
import { FileUpload } from '../../components/common/FileUpload';
import { procesarDxf } from '../../lib/produccion/plan';
import { toast } from 'sonner';
import { imprimirPresupuestoArgentino } from '../../utils/presupuestoExporter';
import { generatePlanImage } from '../../utils/planImage';

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
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [fecha, setFecha] = useState('');
  const [notas, setNotas] = useState('');
  const [medidasCorregidas, setMedidasCorregidas] = useState(false);
  const [jobDetails, setJobDetails] = useState<any>(null);
  const [adjuntoUrl, setAdjuntoUrl] = useState<string>('');
  const [adjuntoNombre, setAdjuntoNombre] = useState<string>('');
  const [dxfProcessing, setDxfProcessing] = useState(false);
  const [revisionesPlano, setRevisionesPlano] = useState<any[]>([]);
  const [planoInfo, setPlanoInfo] = useState<any>(null);
  const isFinanzas = mode === 'finanzas';
  const visitaRealizadaFinal = visitaRealizada ?? Boolean(jobDetails?.trabajo?.visita_tecnica);
  const aprobadoJefeFinal = aprobadoJefe ?? Boolean(jobDetails?.trabajo?.aprobado_jefe);

  // Cargar datos si ya existen
  useEffect(() => {
    if (open && trabajoId) {
      fetchJobDetails();
    }
  }, [open, trabajoId]);

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
    if (!trabajoId) return;
    setLoading(true);
    try {
      await post(`/api/trabajos/${trabajoId}/validar/visita`, {});
      toast.success("Visita marcada como realizada");
      await fetchJobDetails();
    } catch (error) {
      toast.error("No se pudo marcar la visita como realizada. Verifique seña y medidas.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarVisita = async () => {
    if (!trabajoId) {
      toast.error("Error: No hay una Orden de Trabajo asociada aún.");
      return;
    }

    // Validar fecha si es la primera vez (no realizada) o si se está intentando agendar
    if (!visitaRealizadaFinal && !fecha) {
      toast.error("Debe indicar una fecha sugerida para la visita");
      return;
    }

    setLoading(true);
    try {
      await patch(`/api/trabajos/${trabajoId}/visita`, {
        fecha_visita_sugerida: fecha,
        notas_tecnicas: notas
      });

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

    // Validación de requisitos ANTES de intentar aprobación
    const requisitos = jobDetails?.trabajo || {};
    const falta = [];

    if (!requisitos.visita_tecnica) {
      falta.push("Visita Técnica no realizada");
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

  const handleDescargarPlanoSolo = () => {
    if (!jobDetails?.presupuesto) return;

    const p = jobDetails.presupuesto;
    let linkUbicacion = undefined;
    if (coordenadas) {
      const coords = coordenadas.replace(/\s/g, '');
      linkUbicacion = `https://www.google.com/maps?q=${coords}`;
    }

    // Extraer SOLO las imágenes de los planos sin toda la información del presupuesto
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
          } catch { }
        }
      }
    }

    // Crear un documento minimalista con SOLO el plano y medidas
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;

    // Header
    doc.setFontSize(16);
    doc.text('PLANO TÉCNICO CON LARGO Y ANCHO', margin, margin + 5);
    doc.setFontSize(10);
    doc.text(`Cliente: ${clienteNombre}`, margin, margin + 12);
    doc.text(`Dirección: ${direccion || 'No especificada'}`, margin, margin + 17);
    if (linkUbicacion) {
      doc.textWithLink(`Ubicación: ${linkUbicacion}`, margin, margin + 22, { pageNumber: 0 });
    }
    doc.text(`Material: ${material}`, margin, margin + 27);

    // Línea separadora
    doc.setDrawColor(200);
    doc.line(margin, margin + 32, pageWidth - margin, margin + 32);

    // Mostrar imágenes de planos
    let yPos = margin + 38;
    if (anexosImagenes.length > 0) {
      const imgWidth = pageWidth - 2 * margin;
      const imgHeight = 120;

      for (const imgData of anexosImagenes) {
        if (yPos + imgHeight > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }
        doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 5;
      }
    } else {
      doc.text('No hay planos técnicos disponibles', margin, yPos);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generado: ${new Date().toLocaleString()}`,
      margin,
      pageHeight - margin,
      { align: 'left' }
    );

    doc.save(`Plano_${presupuestoId.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Plano técnico descargado (solo medidas)');
  };

  const handleDescargarPDF = () => {
    if (!jobDetails?.presupuesto) return;

    const p = jobDetails.presupuesto;

    console.log('=== DEBUG PRESUPUESTO ===');
    console.log('Presupuesto completo:', p);
    console.log('Número de líneas:', p.lineas?.length);

    const piezasDetalle = (Array.isArray(p.lineas) ? p.lineas : []).flatMap((l: any, idx: number) => {
      console.log(`\n--- Línea ${idx + 1} ---`);
      console.log('Material:', l.material);
      console.log('Tiene geometria_json:', !!l?.geometria_json);

      if (!l?.geometria_json) {
        console.log('⚠️ No hay geometria_json en esta línea');
        return [];
      }

      try {
        const geo = JSON.parse(l.geometria_json);
        console.log('geometria_json parseado:', geo);
        console.log('Tiene placements:', !!geo?.placements);
        console.log('Número de placements:', geo?.placements?.length || 0);

        const placements = Array.isArray(geo?.placements) ? geo.placements : [];

        if (placements.length === 0) {
          console.log('⚠️ No hay placements en esta línea');
        }

        return placements.map((pl: any, pIdx: number) => {
          console.log(`  Placement ${pIdx + 1}:`, pl);
          return {
            w: Number(pl.w || 0),
            h: Number(pl.h || 0),
            agujeros: Array.isArray(pl.agujeros) ? pl.agujeros.length : 0,
            label: `Pieza ${idx + 1}.${pIdx + 1}: ${pl.w || 0} x ${pl.h || 0} cm${pl.agujeros?.length ? ` (${pl.agujeros.length} aguj.)` : ''}`
          };
        });
      } catch (err) {
        console.error('❌ Error parseando geometria_json:', err);
        return [];
      }
    });

    console.log('\n=== RESUMEN ===');
    console.log('Total piezas encontradas:', piezasDetalle.length);
    console.log('Piezas detalle:', piezasDetalle);

    const items = p.lineas.map((l: any) => ({
      detalle: l.material,
      medidas: "Según Plano Adjunto",
      cantidad: parseFloat(l.metros_cuadrados),
      precioUnitario: parseFloat(l.precio_unitario),
      total: parseFloat(l.metros_cuadrados) * parseFloat(l.precio_unitario) + parseFloat(l.recargo_extra || 0)
    }));

    let linkUbicacion = undefined;
    if (coordenadas) {
      const coords = coordenadas.replace(/\s/g, '');
      linkUbicacion = `https://www.google.com/maps?q=${coords}`;
    }

    const anexosImagenes: string[] = [];
    console.log('\n=== GENERANDO ANEXO 2 (PLANOS) ===');
    if (Array.isArray(p.lineas)) {
      for (const l of p.lineas) {
        if (l.geometria_json) {
          try {
            const geo = JSON.parse(l.geometria_json);
            console.log('Procesando plano para línea:', l.material);
            console.log('geometria_json:', geo);

            const board = geo.boardConfig || geo.effective_board || { width: 300, height: 180 };
            console.log('Board config:', board);

            const plan = {
              effective_board: { width: board.width, height: board.height },
              placements: geo.placements || [],
              cuts: [],
              features: geo.features || []
            };
            console.log('Plan a renderizar:', plan);

            const img = generatePlanImage(plan);
            console.log('Imagen generada, tamaño:', img?.length || 0, 'bytes');

            if (img) {
              anexosImagenes.push(img);
              console.log('✓ Imagen agregada al Anexo 2');
            } else {
              console.log('⚠️ generatePlanImage devolvió vacío');
            }
          } catch (err) {
            console.error('❌ Error generando imagen del plano:', err);
          }
        } else {
          console.log('⚠️ Línea sin geometria_json:', l.material);
        }
      }
    }
    console.log('Total imágenes en Anexo 2:', anexosImagenes.length);

    const correlativo = Number((p as any).correlativo_global || 0);
    const correlativoText = correlativo > 0 ? String(correlativo).padStart(6, '0') : '000000';
    const clienteFile = (clienteNombre || 'Cliente').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const nombreArchivo = `${clienteFile} - ${correlativoText}.pdf`;

    imprimirPresupuestoArgentino({
      id: `P-${p.id.slice(0, 6)}`,
      nombreArchivo,
      correlativoGlobal: correlativo || undefined,
      fecha: new Date().toLocaleDateString(),
      cliente: {
        nombre: clienteNombre,
        dni_cuit: "",
        direccion: direccion || "",
        telefono: "",
        condicionIva: "Consumidor Final"
      },
      linkUbicacion,
      empresa: {
        nombre: "Mundo di Marmi",
        cuit: "20-XXXXXXXX-X",
        direccion: "San Juan, Argentina"
      },
      items: items,
      total: p.total,
      subtotalNeto: Number((p as any).subtotal_neto ?? p.total),
      ivaMonto: Number((p as any).iva_monto ?? 0),
      totalFinal: Number((p as any).total_final ?? p.total),
      observaciones: p.observaciones,
      anexosImagenes,
      piezasDetalle: piezasDetalle.length > 0 ? piezasDetalle : undefined
    });
  };

  const handleDescargarDWG = () => {
    if (jobDetails?.dxf_url) {
      const url = jobDetails.dxf_url.startsWith('http')
        ? jobDetails.dxf_url
        : `${window.location.origin}${jobDetails.dxf_url}`;
      window.open(url, '_blank');
    } else {
      toast.error("No hay archivo DWG asociado a este presupuesto");
    }
  };

  const senaAbonada = true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <Calendar className="h-6 w-6 text-cyan-600" />
            Orden de Visita Técnica
          </DialogTitle>
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
                <div className="flex gap-2 bg-gradient-to-r from-cyan-50 to-cyan-50 p-4 rounded-lg border-2 border-cyan-200 shadow-sm">
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-cyan-900 mb-3">Descargas Disponibles</h4>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDescargarPlanoSolo}
                        className="gap-2 text-cyan-700 bg-white border-cyan-300 hover:bg-cyan-50"
                      >
                        <FileText className="h-4 w-4 text-green-600" />
                        <span className="font-semibold">Plano + Largo y Ancho</span>
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
                        disabled={!jobDetails?.dxf_url}
                        className="gap-2 text-cyan-700 bg-white border-cyan-300 hover:bg-cyan-50"
                      >
                        <FileCode className="h-4 w-4 text-cyan-600" />
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
                    <Button variant="link" size="sm" className="h-auto p-0 text-cyan-600" onClick={() => window.open(planoInfo.ultimo_archivo, '_blank')}>
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
                          <Button variant="link" size="sm" className="h-auto p-0 text-cyan-600" onClick={() => window.open(rev.archivo_url, '_blank')}>
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
              <div className="grid gap-3 bg-gradient-to-r from-cyan-50 to-purple-50 p-4 rounded-lg border-2 border-cyan-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-cyan-600" />
                  <h4 className="font-semibold text-cyan-900">Plano Técnico Corregido</h4>
                </div>
                <p className="text-xs text-cyan-800">Cargue el archivo DWG de AutoCAD con las medidas corregidas. El sistema extraerá automáticamente las dimensiones.</p>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white border-cyan-200 text-cyan-700 hover:bg-cyan-50"
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
                    <Label className="text-xs font-bold text-cyan-900">Archivo DWG (AutoCAD) - Recomendado</Label>
                    <div className="flex items-center gap-2 p-3 bg-white rounded border border-cyan-200">
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
                        <div className="flex items-center gap-2 text-cyan-600">
                          <span className="text-xs animate-pulse">Procesando...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Opción 2: Plano en Imagen */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-cyan-900">O Plano en Imagen (PDF/JPG)</Label>
                    <FileUpload
                      label="Subir plano como imagen (si no tiene DWG)"
                      accept=".pdf,image/*"
                      onUploadComplete={async (url, filename) => {
                        setAdjuntoUrl(url);
                        setAdjuntoNombre(filename);
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
                    <Button variant="link" size="sm" className="h-auto p-0 text-cyan-600" onClick={() => window.open(`https://www.google.com/maps?q=${coordenadas}`, '_blank')}>
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
                <div className="flex items-center space-x-2 bg-cyan-50 p-3 rounded-md border border-cyan-100">
                  <input
                    type="checkbox"
                    id="medidas"
                    aria-label="Validar medidas"
                    className="h-4 w-4 text-cyan-600 rounded cursor-pointer"
                    checked={medidasCorregidas}
                    onChange={(e) => setMedidasCorregidas(e.target.checked)}
                  />
                  <Label htmlFor="medidas" className="text-sm font-medium text-cyan-900 cursor-pointer">
                    ✓ He validado y corregido las medidas reales en obra
                  </Label>
                </div>
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
              disabled={loading || !fecha}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              Guardar Cambios
            </Button>

            {!isFinanzas && !visitaRealizadaFinal && (
              <Button
                onClick={handleMarcarVisitaRealizada}
                disabled={loading || !medidasCorregidas}
                title={!medidasCorregidas ? 'Primero valida las medidas marcando el checkbox' : ''}
                className="bg-green-600 hover:bg-green-700"
              >
                Marcar Visita Realizada
              </Button>
            )}

            {!isFinanzas && visitaRealizadaFinal && !aprobadoJefeFinal && (
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
