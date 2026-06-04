import { useState, useRef, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDrag, useDrop } from 'react-dnd';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  GripVertical, Hammer, Clock, AlertCircle, Eye, Printer,
  Layers, Maximize2, Tag, CheckCircle2, Info, FileText, MapPin, Phone, Mail, Image as ImageIcon, Box, Trash2, Filter
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { useProduccion, OrdenProduccion, EstadoProduccion } from '../../context/ProduccionContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "../../components/ui/dialog";
import { toast } from 'sonner';
import { get, del, post } from '../../api';
import { API_BASE_URL } from '../../config';
import { BRAND_MONOGRAM } from '../../brand';

/** Base para URLs absolutas de estáticos del backend; vacío = mismo origen (nginx hace proxy de /uploads, /static, /api). */
const STATIC_ASSET_BASE = API_BASE_URL;

const COLUMNAS: { id: EstadoProduccion; titulo: string; color: string }[] = [
  { id: 'planificacion', titulo: 'Planificación', color: 'bg-slate-100' },
  { id: 'en_acumulador', titulo: 'Acumulando (Mat)', color: 'bg-orange-50' },
  { id: 'listo_para_corte', titulo: 'Listo para Corte', color: 'bg-cyan-50' },
  { id: 'corte', titulo: 'En Corte', color: 'bg-blue-50' },
  { id: 'pulido', titulo: 'En Pulido', color: 'bg-indigo-50' },
  { id: 'control_calidad', titulo: 'Control Calidad', color: 'bg-purple-50' },
  { id: 'listo_entrega', titulo: 'Listo Entrega', color: 'bg-emerald-50' },
  { id: 'concluido', titulo: 'Historial', color: 'bg-slate-100' },
];

interface TarjetaOrdenProps {
  orden: OrdenProduccion;
  onVerDetalle: (orden: OrdenProduccion) => void;
  onAvanzar?: (orden: OrdenProduccion) => void;
  onEliminar?: (ordenId: string) => void;
}

function TarjetaOrden({ orden, onVerDetalle, onAvanzar, onEliminar }: TarjetaOrdenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: 'orden',
      item: { id: orden.id, estadoActual: orden.estado },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [orden.id, orden.estado]
  );
  drag(ref);

  const colorPrioridad = {
    alta: 'bg-red-50 text-red-700 border-red-200',
    media: 'bg-amber-50 text-amber-700 border-amber-200',
    baja: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const handleImprimirEtiquetas = async () => {
    if (orden.source === 'n12') {
      try {
        const rows = await get<
          Array<{ codigo_etiqueta: string; tipo: string; metadata_json?: Record<string, unknown> }>
        >(`/api/n12/etiquetas?op_id=${orden.id}`);
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        let html = `
          <html><head><title>Etiquetas N12</title>
          <style>
            @page { size: 100mm 150mm; margin: 0; }
            body { font-family: sans-serif; margin: 0; padding: 10px; }
            .etiqueta { border: 2px solid black; padding: 12px; margin-bottom: 16px; page-break-after: always; }
            .code { font-size: 22px; font-weight: bold; font-family: monospace; }
          </style></head><body>`;
        const list = Array.isArray(rows) ? rows : [];
        if (list.length === 0) {
          html += '<p>Sin etiquetas registradas para esta OP.</p>';
        } else {
          list.forEach((r) => {
            const meta = r.metadata_json || {};
            html += `<div class="etiqueta">
              <div class="code">${r.codigo_etiqueta}</div>
              <div>Tipo: ${r.tipo}</div>
              <div>Cliente: ${orden.cliente}</div>
              <div>Presupuesto: ${orden.presupuesto}</div>
              ${meta.largo_mm != null ? `<div>${meta.largo_mm} × ${meta.ancho_mm} mm</div>` : ''}
            </div>`;
          });
        }
        html += `<script>window.print(); window.close();</script></body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
        toast.success('Generando etiquetas N12…');
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Error al cargar etiquetas N12');
      }
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const piezas = orden.piezas || [
      { id: `${orden.id}-1`, nombre: 'Mesada Principal', medidas: orden.medidas, ubicacion: 'Cocina', tipo: 'principal' as const },
      { id: `${orden.id}-2`, nombre: 'Zócalo lateral', medidas: '60x10', ubicacion: 'Cocina', tipo: 'terminacion' as const }
    ];

    let html = `
      <html>
        <head>
          <title>Etiquetas - ${orden.cliente}</title>
          <style>
            @page { size: 100mm 150mm; margin: 0; }
            body { font-family: sans-serif; margin: 0; padding: 10px; }
            .etiqueta { 
              border: 2px solid black; 
              padding: 15px; 
              margin-bottom: 20px; 
              page-break-after: always;
              height: 130mm;
              display: flex;
              flex-direction: column;
            }
            .header { border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; }
            .title { font-size: 18px; font-weight: bold; }
            .field { margin: 5px 0; font-size: 14px; }
            .label { font-weight: bold; color: #666; }
            .checklist { margin-top: 20px; border-top: 1px solid #000; padding-top: 10px; }
            .check-item { margin: 8px 0; display: flex; align-items: center; }
            .box { width: 15px; height: 15px; border: 1px solid black; margin-right: 10px; }
          </style>
        </head>
        <body>
    `;

    piezas.forEach(pieza => {
      html += `
        <div class="etiqueta">
          <div class="header">
            <div class="title">${BRAND_MONOGRAM} - ETIQUETA DE PIEZA</div>
            <div class="field"><span class="label">CLIENTE:</span> ${orden.cliente}</div>
          </div>
          <div class="field"><span class="label">ORDEN / PIEZA:</span> ${orden.id.slice(0, 8)} / ${pieza.id.slice(-4)}</div>
          <div class="field"><span class="label">PRESUPUESTO:</span> ${orden.presupuesto}</div>
          <div class="field"><span class="label">MATERIAL:</span> ${orden.material}</div>
          <div class="field"><span class="label">LOTE:</span> ${orden.lote}</div>
          <div class="field"><span class="label">LARGO Y ANCHO:</span> ${pieza.medidas}</div>
          <div class="field"><span class="label">UBICACIÓN:</span> ${pieza.nombre}</div>
          
          <div class="checklist">
            <div style="font-weight: bold; margin-bottom: 10px;">CHECKLIST DE CALIDAD:</div>
            <div class="check-item"><div class="box"></div> Pieza bien pulida</div>
            <div class="check-item"><div class="box"></div> Sin puntas rotas</div>
            <div class="check-item"><div class="box"></div> Cortes en medidas correctas</div>
            <div class="check-item"><div class="box"></div> Fajas y bordes correctos</div>
            <div class="check-item"><div class="box"></div> Limpieza general</div>
          </div>
        </div>
      `;
    });

    html += `
        <script>window.print(); window.close();</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    toast.success('Generando etiquetas para imprimir...');
  };

  return (
    <div
      ref={ref}
      className={`
        bg-white rounded-xl p-4 shadow-sm border border-border
        cursor-move hover:shadow-md hover:border-primary/30
        transition-all duration-200
        ${isDragging ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Presupuesto</span>
            <span className="text-primary font-mono text-xs font-bold bg-blue-50 px-1 rounded">{orden.presupuesto}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge
            variant="outline"
            className={`${colorPrioridad[orden.prioridad]} text-[10px] px-2 py-0`}
          >
            {orden.prioridad.toUpperCase()}
          </Badge>
          {onEliminar && orden.source !== 'n12' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                onEliminar(orden.id);
              }}
              title="Eliminar Orden"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <h4 className="text-foreground font-bold text-sm mb-1 leading-tight">{orden.cliente}</h4>
      <div className="space-y-1 mb-3">
        {orden.acumuladoId && (
          <div className="flex items-center gap-1 mb-2">
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 text-[9px] h-4">
              <Layers className="h-2 w-2 mr-1" /> GRUPO {orden.acumuladoId.slice(0, 5)}
            </Badge>
          </div>
        )}
        <p className="text-muted-foreground text-xs flex items-center gap-1">
          <Layers className="h-3 w-3" /> {orden.material} (Lote: {orden.lote})
        </p>
        <p className="text-muted-foreground text-xs flex items-center gap-1">
          <Maximize2 className="h-3 w-3" /> Largo y Ancho: {orden.medidas}
        </p>
        <p className="text-muted-foreground text-xs flex items-center gap-1">
          <Info className="h-3 w-3" /> Bacha: {orden.bacha}
        </p>
        <p className="text-primary font-medium text-[10px] flex items-center gap-1 mt-2">
          <Clock className="h-3 w-3" /> Entrega: {orden.fechaCompromiso}
        </p>
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8 text-[10px] gap-1"
          onClick={() => onVerDetalle(orden)}
        >
          <Eye className="h-3 w-3" /> Detalle
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 h-8 text-[10px] gap-1"
          onClick={handleImprimirEtiquetas}
        >
          <Printer className="h-3 w-3" /> Etiquetas
        </Button>
        {onAvanzar && (
          <Button
            size="sm"
            className="flex-1 h-8 text-[10px] gap-1 bg-green-600 text-white hover:bg-green-700 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              onAvanzar(orden);
            }}
          >
            <CheckCircle2 className="h-3 w-3" /> Avanzar
          </Button>
        )}
      </div>
    </div>
  );
}

interface ColumnaKanbanProps {
  columna: { id: EstadoProduccion; titulo: string; color: string };
  ordenes: OrdenProduccion[];
  onDrop: (ordenId: string, nuevoEstado: EstadoProduccion) => void;
  onVerDetalle: (orden: OrdenProduccion) => void;
}

function ColumnaKanban({ columna, ordenes, onDrop, onVerDetalle, onAvanzar, onEliminar }: ColumnaKanbanProps & { onAvanzar?: (orden: OrdenProduccion) => void; onEliminar: (ordenId: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: 'orden',
      drop: (item: { id: string; estadoActual: EstadoProduccion }) => {
        if (item.estadoActual !== columna.id) {
          onDrop(item.id, columna.id);
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }),
    [columna.id, onDrop]
  );
  drop(ref);

  return (
    <div className="flex flex-col h-full min-w-[280px]">
      <div className="mb-4 px-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">{columna.titulo}</h3>
          <Badge variant="secondary" className="bg-primary/10 text-primary font-bold">
            {ordenes.length}
          </Badge>
        </div>
      </div>

      <div
        ref={ref}
        className={`
          flex-1 rounded-xl p-3 space-y-3 min-h-[600px]
          transition-all duration-200
          ${columna.color}
          ${isOver ? 'ring-2 ring-primary shadow-lg scale-[1.01]' : 'shadow-sm border border-slate-200/50'}
        `}
      >
        {ordenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs opacity-50 border-2 border-dashed border-slate-200 rounded-lg">
            <Tag className="h-6 w-6 mb-2" />
            Sin órdenes
          </div>
        ) : (
          ordenes.map((orden) => (
            <TarjetaOrden
              key={orden.id}
              orden={orden}
              onVerDetalle={onVerDetalle}
              onAvanzar={columna.id === 'concluido' ? undefined : onAvanzar}
              onEliminar={onEliminar}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DashboardTallerContent() {
  const { ordenes, actualizarEstado, recargarOrdenes } = useProduccion();
  const [searchParams] = useSearchParams();
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenProduccion | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  // Estado para el detalle extendido
  const [ordenDetalle, setOrdenDetalle] = useState<any>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const acumuladoId = searchParams.get('acumulado');

  const ordenesFiltradas = useMemo(() => {
    let filtered = ordenes;
    if (acumuladoId) {
      filtered = filtered.filter(o => o.acumuladoId === acumuladoId);
    }

    return filtered.filter(o => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        o.cliente.toLowerCase().includes(q) ||
        o.presupuesto.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.material.toLowerCase().includes(q);

      const matchesFecha = !filtroFecha || (o.fechaCompromiso && o.fechaCompromiso.includes(filtroFecha));
      const matchesEstado = filtroEstado === 'todos' || o.estado === filtroEstado;

      return matchesSearch && matchesFecha && matchesEstado;
    });
  }, [ordenes, acumuladoId, searchTerm, filtroFecha, filtroEstado]);

  const handleDrop = async (ordenId: string, nuevoEstado: EstadoProduccion) => {
    actualizarEstado(ordenId, nuevoEstado);
  };

  const handleAvanzarEtapa = async (ordenParam?: OrdenProduccion) => {
    const orden = ordenParam || ordenSeleccionada;
    if (!orden) return;

    const currentIndex = COLUMNAS.findIndex(c => c.id === orden.estado);
    if (currentIndex === -1 || currentIndex === COLUMNAS.length - 1) {
      toast.info('La orden ya se encuentra en la etapa final');
      return;
    }

    const nextStage = COLUMNAS[currentIndex + 1].id;

    try {
      await actualizarEstado(orden.id, nextStage);
      toast.success(`Avanzado a ${COLUMNAS[currentIndex + 1].titulo}`);
      if (!ordenParam) setOrdenSeleccionada(null); // Solo cerrar si es desde el modal
    } catch (error) {
      console.error(error);
      toast.error('Error al avanzar de etapa');
    }
  };

  const handleEliminarOrden = async (ordenId: string) => {
    const target = ordenes.find((o) => o.id === ordenId);
    if (target?.source === 'n12') {
      toast.error('Las órdenes Nivel 12 no se eliminan desde el tablero.');
      return;
    }
    if (!window.confirm('¿Estás seguro de eliminar esta ORDEN completa? Esta acción no se puede deshacer.')) return;
    try {
      await del(`/api/trabajos/${ordenId}`);
      toast.success('Orden eliminada correctamente');
      recargarOrdenes();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error al eliminar la orden');
    }
  };

  const handleEliminarPieza = async (piezaId: string) => {
    if (!window.confirm('¿Estás seguro de eliminar esta pieza? Esto afectará las etiquetas a imprimir.')) return;
    try {
      await del(`/api/piezas/${piezaId}`);
      toast.success('Pieza eliminada');
      // Recargar el detalle y la lista global
      recargarOrdenes();
      if (ordenSeleccionada) {
        const detail = await get(`/api/trabajos/${ordenSeleccionada.id}/detalle`);
        setOrdenDetalle(detail);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error de conexión');
    }
  };

  // Cargar detalle extendido al abrir modal
  useEffect(() => {
    if (ordenSeleccionada) {
      setLoadingDetalle(true);
      setOrdenDetalle(null);
      const req =
        ordenSeleccionada.source === 'n12'
          ? get<{
              cliente_nombre: string;
              detalles: Array<{
                id: string;
                nombre_pieza: string;
                largo_mm: number;
                ancho_mm: number;
                cantidad: number;
                estado: string;
                estacion_actual: string;
              }>;
              etiquetas: Array<{ codigo_etiqueta: string; tipo: string; estado: string }>;
            }>(`/api/n12/op/${ordenSeleccionada.id}`).then((data) => ({
              n12: true as const,
              cliente: { nombre: data.cliente_nombre },
              trabajo: {
                piezas: (data.detalles || []).map((d) => ({
                  id: d.id,
                  nombre: d.nombre_pieza,
                  h: d.largo_mm / 10,
                  w: d.ancho_mm / 10,
                  qty: d.cantidad,
                  ubicacion: `${d.estado} · ${d.estacion_actual}`,
                })),
              },
              etiquetas_n12: data.etiquetas || [],
            }))
          : get(`/api/trabajos/${ordenSeleccionada.id}/detalle`);
      Promise.resolve(req)
        .then(setOrdenDetalle)
        .catch((err) => {
          console.error(err);
          toast.error("Error cargando detalles extendidos");
        })
        .finally(() => setLoadingDetalle(false));
    } else {
      setOrdenDetalle(null);
    }
  }, [ordenSeleccionada]);

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      <PageHeader
        icon={Hammer}
        title={acumuladoId ? `Taller: Grupo ${acumuladoId.slice(0, 8)}` : "Dashboard de Taller"}
        description={acumuladoId ? "Filtrado por acumulado específico" : "Gestión visual de órdenes de producción y control de calidad"}
      />

      {/* Barra de Filtros */}
      <div className="px-4 sm:px-6 py-2 border-b bg-white flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar por cliente, presupuesto, ID..."
            className="h-8 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={() => setIsFilterDialogOpen(true)}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        </div>
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtros de Dashboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Fecha Compromiso</Label>
              <Input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Estado / Columna</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="todos">Todos los estados</option>
                {COLUMNAS.map(c => (
                  <option key={c.id} value={c.id}>{c.titulo}</option>
                ))}
              </select>
            </div>
            <Button variant="ghost" className="w-full mt-4" onClick={() => {
              setFiltroFecha('');
              setFiltroEstado('todos');
            }}>
              Limpiar Filtros
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex-1 overflow-x-auto p-4 sm:p-6">
        <div className="flex gap-4 pb-4 min-w-max h-full">
          {COLUMNAS.map((columna) => (
            <ColumnaKanban
              key={columna.id}
              columna={columna}
              ordenes={ordenesFiltradas.filter((orden) => orden.estado === columna.id)}
              onDrop={handleDrop}
              onVerDetalle={setOrdenSeleccionada}
              onAvanzar={handleAvanzarEtapa}
              onEliminar={handleEliminarOrden}
            />
          ))}
        </div>
      </div>

      <Dialog open={!!ordenSeleccionada} onOpenChange={() => setOrdenSeleccionada(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-6 w-6 text-primary" />
              Orden de Producción: {ordenSeleccionada?.cliente}
            </DialogTitle>
            <DialogDescription>
              Presupuesto: {ordenSeleccionada?.presupuesto} | Estado Actual: <Badge>{ordenSeleccionada?.estado}</Badge>
            </DialogDescription>
          </DialogHeader>

          {loadingDetalle ? (
            <div className="py-20 flex justify-center items-center text-muted-foreground">
              <Clock className="h-6 w-6 animate-spin mr-2" /> Cargando información completa...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              {/* COLUMNA IZQUIERDA */}
              <div className="space-y-6">
                {/* INFO CLIENTE */}
                <div className="bg-white p-4 rounded-lg border shadow-sm">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 border-b pb-2">
                    <Info className="h-4 w-4" /> Información del Cliente
                  </h4>
                  {ordenDetalle?.cliente ? (
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-[20px_1fr] gap-2 items-start">
                        <Info className="h-4 w-4 text-slate-400 mt-0.5" />
                        <span className="font-medium">{ordenDetalle.cliente.nombre}</span>
                      </div>
                      {ordenDetalle.cliente.direccion && (
                        <div className="grid grid-cols-[20px_1fr] gap-2 items-start">
                          <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                          <span>{ordenDetalle.cliente.direccion}</span>
                        </div>
                      )}
                      {ordenDetalle.cliente.telefono && (
                        <div className="grid grid-cols-[20px_1fr] gap-2 items-center">
                          <Phone className="h-4 w-4 text-slate-400" />
                          <span>{ordenDetalle.cliente.telefono}</span>
                        </div>
                      )}
                      {ordenDetalle.cliente.email && (
                        <div className="grid grid-cols-[20px_1fr] gap-2 items-center">
                          <Mail className="h-4 w-4 text-slate-400" />
                          <a href={`mailto:${ordenDetalle.cliente.email}`} className="text-blue-600 hover:underline">{ordenDetalle.cliente.email}</a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Cargando datos del cliente...</p>
                  )}
                </div>

                {/* DATOS TÉCNICOS & MATERIAL */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
                    <Layers className="h-4 w-4" /> Material & Lote
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="block text-xs font-semibold text-slate-500 uppercase">Material</span>
                      <span className="text-base font-medium">{ordenSeleccionada?.material}</span>
                    </div>

                    {ordenDetalle?.lote ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="block text-xs font-semibold text-slate-500 uppercase">Lote ID</span>
                          <span className="font-mono bg-white px-1 rounded border">{ordenDetalle.lote.codigo}</span>
                        </div>
                        <div>
                          <span className="block text-xs font-semibold text-slate-500 uppercase">Ubicación</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {ordenDetalle.lote.ubicacion || "N/A"}
                          </span>
                        </div>
                        {ordenDetalle.lote.foto_url && (
                          <div className="col-span-2 mt-2">
                            <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">Foto del Lote</span>
                            <img
                              src={`${STATIC_ASSET_BASE}${ordenDetalle.lote.foto_url}`}
                              alt="Lote"
                              className="h-32 w-full object-cover rounded-md border"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="block text-xs font-semibold text-slate-500 uppercase">Lote</span>
                        <span>{ordenSeleccionada?.lote}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* PLANO TÉCNICO */}
                {ordenDetalle?.plano ? (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Plano Técnico Aprobado
                    </h4>
                    <p className="text-xs text-blue-600 mb-3">Versión oficial para producción</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="bg-white" onClick={() => window.open(ordenDetalle.plano.imagen_url ? `${STATIC_ASSET_BASE}${ordenDetalle.plano.imagen_url}` : '#', '_blank')}>
                        <Eye className="h-3 w-3 mr-1" /> Ver Plano
                      </Button>
                      {ordenDetalle.dxf_url && (
                        <Button size="sm" variant="outline" className="bg-white" onClick={() => window.open(`${STATIC_ASSET_BASE}${ordenDetalle.dxf_url}`, '_blank')}>
                          <Maximize2 className="h-3 w-3 mr-1" /> Descargar DXF
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center text-center">
                    <FileText className="h-8 w-8 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">Sin plano técnico vinculado</p>
                  </div>
                )}
              </div>

              {/* COLUMNA DERECHA */}
              <div className="space-y-6">
                {/* PIEZAS */}
                <div className="bg-white p-4 rounded-lg border shadow-sm h-full flex flex-col">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 border-b pb-2">
                    <Box className="h-4 w-4" /> Piezas a Producir
                  </h4>

                  <div className="flex-1 overflow-auto max-h-[400px]">
                    {ordenDetalle?.trabajo?.piezas && ordenDetalle.trabajo.piezas.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 sticky top-0">
                          <tr>
                            <th className="px-2 py-2 text-left">Pieza</th>
                            <th className="px-2 py-2 text-center">Largo y Ancho</th>
                            <th className="px-2 py-2 text-center">Cant.</th>
                            <th className="px-2 py-2 text-center">Ubicación</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {ordenDetalle.trabajo.piezas.map((p: any) => (
                            <tr key={p.id}>
                              <td className="px-2 py-2 font-medium">{p.nombre || "Pieza sin nombre"}</td>
                              <td className="px-2 py-2 text-center">{p.h} x {p.w} cm</td>
                              <td className="px-2 py-2 text-center">{p.qty}</td>
                              <td className="px-2 py-2 text-center">
                                {p.ubicacion ? (
                                  <Badge variant="outline" className="text-[10px]">{p.ubicacion}</Badge>
                                ) : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No hay piezas registradas para este trabajo.
                      </div>
                    )}
                  </div>

                  {/* NOTAS */}
                  <div className="mt-4 bg-amber-50 p-3 rounded-lg border border-amber-100">
                    <h4 className="text-xs font-bold text-amber-700 mb-2 uppercase flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Notas de Producción
                    </h4>
                    <p className="text-sm text-amber-800 whitespace-pre-wrap">
                      {ordenSeleccionada?.notas || "Sin notas adicionales."}
                    </p>
                    {ordenDetalle?.presupuesto?.observaciones && (
                      <div className="mt-2 pt-2 border-t border-amber-200/50">
                        <p className="text-xs font-bold text-amber-700">Obs. Presupuesto:</p>
                        <p className="text-xs text-amber-800 italic">{ordenDetalle.presupuesto.observaciones}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOrdenSeleccionada(null)}>Cerrar</Button>
            <Button
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => handleAvanzarEtapa()}
            >
              <CheckCircle2 className="h-4 w-4" /> Avanzar Etapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DashboardTaller() {
  return (
    <DashboardTallerContent />
  );
}

