import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
    Search, Filter, Calendar, MapPin, CheckCircle2, Clock, AlertCircle,
    FileText, Eye, Loader2, Plus, MapPinIcon, Phone, Download
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { get, post, patch } from '../../api';
import { toast } from 'sonner';
import { OrdenVisitaDialog } from '../finanzas/OrdenVisitaDialog';
import { generatePlanImage } from '../../utils/planImage';
import { savePlanoTecnicoLandscapePdf } from '../../utils/planoTecnicoPdfExport';
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "../../components/common/DateRangePicker";
import { isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { useProduccion } from '../../context/ProduccionContext';

interface Presupuesto {
    id: string;
    cliente_id: string;
    cliente_nombre: string;
    direccion?: string;
    coordenadas?: string;
    total: number;
    observaciones: string;
    aceptado_venta?: boolean;
    fecha_aceptado?: string | null;
    estado_pago: string;
    monto_cobrado: number;
    fecha_creacion?: string;
    trabajo_id?: string;
    visita_tecnica_realizada?: boolean;
    aprobado_jefe_produccion?: boolean;
    visita_tecnica_aprobada?: boolean;
    medidas_corregidas?: boolean;
    fecha_visita_sugerida?: string;
    archivado?: boolean;
    has_visita_n12?: boolean;
}

export function GestionOrdenes() {
    const { recargarOrdenes } = useProduccion();
    const [ordenes, setOrdenes] = useState<Presupuesto[]>([]);
    const [visitasN12Count, setVisitasN12Count] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('');
    const [activeTab, setActiveTab] = useState('pendientes');
    const [showSinVisita, setShowSinVisita] = useState(false);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState('todos');
    const [visitaSeleccionada, setVisitaSeleccionada] = useState<Presupuesto | null>(null);
    const [generatingId, setGeneratingId] = useState<string | null>(null);

    interface N12Visita {
        id_visita: string;
        presupuesto_id: string;
        estado: string;
        medidas_confirmadas?: boolean;
        fecha?: string;
    }

    const fetchOrdenes = async () => {
        setLoading(true);
        try {
            try {
                await post<{ canceladas?: number; eliminadas?: number }>('/api/n12/visitas/sanear-inconsistencias', {});
            } catch (cleanupError) {
                console.warn('No se pudo ejecutar saneamiento de visitas; se continúa con la carga.', cleanupError);
            }
            // Obtener presupuestos aceptados que no han sido procesados por producción
            const res = await get<Presupuesto[]>('/api/presupuestos?aceptados=true&solo_finanzas=false');
            const cleaned = (res || []).filter((item) => !item.archivado);
            const visitas = await get<N12Visita[]>('/api/n12/visitas');
            setVisitasN12Count((visitas || []).length);
            const visitaByPresupuesto = new Map<string, N12Visita>();
            (visitas || []).forEach((v) => {
                if (!v?.presupuesto_id) return;
                const current = visitaByPresupuesto.get(v.presupuesto_id);
                if (!current) {
                    visitaByPresupuesto.set(v.presupuesto_id, v);
                    return;
                }
                const currentDate = new Date(current.fecha || 0).getTime();
                const nextDate = new Date(v.fecha || 0).getTime();
                if (nextDate >= currentDate) {
                    visitaByPresupuesto.set(v.presupuesto_id, v);
                }
            });

            const merged = cleaned.map((item) => {
                const visita = visitaByPresupuesto.get(item.id);
                const isCompletada = visita?.estado === 'completada';
                return {
                    ...item,
                    has_visita_n12: Boolean(visita),
                    visita_tecnica_realizada: isCompletada || item.visita_tecnica_realizada,
                    visita_tecnica_aprobada: isCompletada || item.visita_tecnica_aprobada,
                    aprobado_jefe_produccion: isCompletada || item.aprobado_jefe_produccion,
                    medidas_corregidas: Boolean(visita?.medidas_confirmadas) || item.medidas_corregidas,
                    fecha_visita_sugerida: visita?.fecha || item.fecha_visita_sugerida,
                };
            });
            setOrdenes(merged);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar órdenes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrdenes();
    }, []);

    const handleGestionarVisita = async (item: Presupuesto) => {
        try {
            let trabajoId = item.trabajo_id;
            if (!trabajoId) {
                // PASO 1: Aceptar presupuesto si no está aceptado
                if (!item.aceptado_venta) {
                    try {
                        await post<any>(`/api/presupuestos/${item.id}/aceptar`, {});
                        toast.success('Presupuesto aceptado');
                    } catch (e) {
                        console.error('Error aceptando presupuesto:', e);
                        toast.error('Error al aceptar presupuesto');
                        return;
                    }
                }

                // PASO 2: Crear trabajo desde presupuesto aceptado
                try {
                    const res = await post<any>(`/api/trabajos/desde-presupuesto/${item.id}`, {});
                    trabajoId = res?.id;
                    if (!trabajoId) throw new Error("missing trabajoId");
                    setOrdenes(prev => prev.map(p => (p.id === item.id ? { ...p, trabajo_id: trabajoId, aceptado_venta: true } : p)));
                } catch (e: any) {
                    const errorMsg = e?.detail || 'Error al crear orden';
                    toast.error(errorMsg);
                    return;
                }
            }
            setVisitaSeleccionada({ ...item, trabajo_id: trabajoId, aceptado_venta: true });
        } catch (error) {
            console.error(error);
            toast.error('Error al inicializar orden de visita');
        }
    };

    const handleDownloadPresupuestoVisita = async (item: Presupuesto) => {
        try {
            const pdfData = await get<Blob>(`/api/presupuestos/${item.id}/pdf/visita`);
            const url = window.URL.createObjectURL(new Blob([pdfData]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Presupuesto_Visita_${item.id.slice(0, 8)}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('Plano técnico descargado');
        } catch {
            toast.error('Error al descargar plano técnico');
        }
    };

    const handleDownloadPlanOnly = async (item: Presupuesto) => {
        try {
            const presupuestoData = await get<any>(`/api/presupuestos/${item.id}`);

            if (!presupuestoData) {
                toast.error('No se pueden cargar los detalles del presupuesto');
                return;
            }

            const anexosImagenes: string[] = [];
            const lineas = Array.isArray(presupuestoData.lineas) ? presupuestoData.lineas : [];

            for (const l of lineas) {
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
                    } catch (e) {
                        console.error('Error procesando geometría:', e);
                    }
                }
            }

            await savePlanoTecnicoLandscapePdf({
                anexosImagenes,
                cliente: {
                    clienteNombre: item.cliente_nombre,
                    direccion: item.direccion,
                    coordenadas: item.coordenadas,
                },
                fileBaseName: `Plano_${item.id.slice(0, 8)}`,
            });
            toast.success('Plano con medidas descargado');
        } catch (error) {
            console.error('Error descargando plano:', error);
            toast.error('Error al descargar plano. Intente desde el diálogo de visita');
        }
    };

    const handleGenerarProduccion = async (item: Presupuesto) => {
        setGeneratingId(item.id);
        try {
            const res = await post<any>(`/api/ordenes-produccion`, {
                presupuesto_id: item.id,
                fecha_entrega_estimada: new Date().toISOString().split('T')[0]
            });
            if (res?.duplicado) {
                toast.info('La orden de producción ya existe para este presupuesto');
            } else {
                toast.success('Orden enviada a pendientes de producción');
            }
            fetchOrdenes();
        } catch (error) {
            console.error(error);
            toast.error('No se pudo generar la orden de producción');
        } finally {
            setGeneratingId(null);
        }
    };

    const handleAprobarTodosRealizados = async () => {
        toast.info('En modo N12, una visita completada ya queda habilitada para el flujo de producción.');
        fetchOrdenes();
    };

    const filteredOrdenes = ordenes.filter(o => {
        // Por origen de flujo (visitas reales vs base de presupuestos sin visita)
        const hasVisita = Boolean(o.has_visita_n12 || o.visita_tecnica_realizada || o.fecha_visita_sugerida);
        if (!showSinVisita && !hasVisita) return false;

        // Por tab
        const isPendiente = !o.visita_tecnica_aprobada;
        if (activeTab === 'pendientes' && !isPendiente) return false;
        if (activeTab === 'aprobadas' && isPendiente) return false;

        // Por búsqueda
        const searchStr = filtro.toLowerCase();
        const clienteNombre = (o.cliente_nombre || '').toLowerCase();
        const matchesSearch = clienteNombre.includes(searchStr) || (o.id || '').toLowerCase().includes(searchStr);

        // Por estado
        const matchesStatus = statusFilter === 'todos' ||
            (statusFilter === 'sin_visita' && !o.visita_tecnica_realizada) ||
            (statusFilter === 'con_visita' && o.visita_tecnica_realizada) ||
            (statusFilter === 'medidas_ok' && o.medidas_corregidas);

        // Por fecha
        let matchesDate = true;
        if (dateRange?.from && o.fecha_creacion) {
            const fecha = new Date(o.fecha_creacion);
            const start = startOfDay(dateRange.from);
            const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            matchesDate = isWithinInterval(fecha, { start, end });
        }

        return matchesSearch && matchesStatus && matchesDate;
    });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-gray-500">Cargando órdenes de visita...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background p-6">
            <PageHeader
                icon={MapPin}
                title="Gestión de Órdenes de Visita"
                description="Base de presupuestos aceptados para agendar/revisar visita técnica y avanzar a producción."
            />

            <Card className="mt-4 border-blue-200 bg-blue-50/60">
                <CardContent className="py-3">
                    <p className="text-sm text-blue-900">
                        Esta lista se arma desde presupuestos aceptados. Visitas N12 existentes: <strong>{visitasN12Count}</strong>.
                        Si es 0, igualmente verás presupuestos pendientes para agendar.
                    </p>
                </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 mt-6">
                <div className="flex justify-between items-center">
                    <TabsList className="bg-muted w-fit">
                        <TabsTrigger value="pendientes" className="gap-2">
                            <Clock className="h-4 w-4" />
                            Pendientes ({ordenes.filter(o => !o.visita_tecnica_aprobada).length})
                        </TabsTrigger>
                        <TabsTrigger value="aprobadas" className="gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Aprobadas ({ordenes.filter(o => o.visita_tecnica_aprobada).length})
                        </TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={showSinVisita ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setShowSinVisita((prev) => !prev)}
                        >
                            {showSinVisita ? "Ocultar sin visita" : "Mostrar sin visita"}
                        </Button>
                        {ordenes.filter(o => o.visita_tecnica_realizada && !o.visita_tecnica_aprobada).length > 0 && (
                            <Button
                                className="bg-green-600 hover:bg-green-700 text-white gap-2"
                                onClick={handleAprobarTodosRealizados}
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Aprobar todas realizadas
                            </Button>
                        )}
                    </div>
                </div>

                {/* Filtros */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por cliente o ID..."
                                value={filtro}
                                onChange={e => setFiltro(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <select
                            title="Filtrar por estado de visita"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="px-4 py-2 border rounded-md border-input bg-background"
                        >
                            <option value="todos">Todos los estados</option>
                            <option value="sin_visita">Sin visita realizada</option>
                            <option value="con_visita">Con visita realizada</option>
                            <option value="medidas_ok">Medidas corregidas</option>
                        </select>

                        <DatePickerWithRange
                            date={dateRange}
                            setDate={setDateRange}
                        />
                    </div>
                </div>

                {/* Lista de órdenes */}
                <div className="space-y-3">
                    {filteredOrdenes.length === 0 ? (
                        <Card className="bg-gray-50 border-dashed">
                            <CardContent className="p-12 text-center">
                                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 font-medium">No hay órdenes de visita en este estado</p>
                                {filtro && <p className="text-sm text-gray-400 mt-2">Intenta cambiar los filtros</p>}
                            </CardContent>
                        </Card>
                    ) : (
                        filteredOrdenes.map(orden => {
                            const estadoVisita = orden.visita_tecnica_realizada
                                ? 'Realizada'
                                : orden.fecha_visita_sugerida
                                    ? 'Agendada'
                                    : 'Pendiente';
                            const estadoAprobacion = orden.aprobado_jefe_produccion
                                ? 'Aprobada'
                                : 'No aprobada';

                            return (
                                <Card key={orden.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {/* Información del cliente */}
                                            <div className="space-y-2">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h3 className="font-bold text-lg text-gray-900">{orden.cliente_nombre}</h3>
                                                        <p className="text-sm text-gray-500 font-mono">#{orden.id.slice(0, 8)}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Badge variant={orden.visita_tecnica_realizada ? "default" : "outline"}>
                                                            {estadoVisita}
                                                        </Badge>
                                                        <Badge variant={orden.aprobado_jefe_produccion ? "default" : "secondary"}>
                                                            {estadoAprobacion}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
                                                    <span>{orden.direccion || 'Sin dirección'}</span>
                                                </div>

                                                {orden.coordenadas && (
                                                    <div className="flex items-center gap-2 text-sm text-blue-600">
                                                        <MapPinIcon className="h-4 w-4" />
                                                        <a href={`https://maps.google.com?q=${orden.coordenadas}`} target="_blank" rel="noreferrer" className="hover:underline">
                                                            Ver ubicación
                                                        </a>
                                                    </div>
                                                )}

                                                <div className="text-sm space-y-1">
                                                    {orden.fecha_visita_sugerida ? (
                                                        <div className="flex items-center gap-2 text-green-600">
                                                            <Calendar className="h-4 w-4" />
                                                            <span><strong>Visita programada:</strong> {new Date(orden.fecha_visita_sugerida).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-orange-600">
                                                            <AlertCircle className="h-4 w-4" />
                                                            <span><strong>Falta programar visita</strong></span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Acciones */}
                                            <div className="flex flex-col justify-between">
                                                <div className="space-y-1 text-sm">
                                                    {orden.medidas_corregidas && (
                                                        <div className="flex items-center gap-2 text-green-600">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                            <span>Medidas corregidas ✓</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex gap-2 mt-4 flex-wrap">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1 min-w-[120px]"
                                                        onClick={() => handleGestionarVisita(orden)}
                                                    >
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        {orden.visita_tecnica_realizada ? 'Revisar' : 'Agendar'} Visita
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-2"
                                                        onClick={() => handleDownloadPlanOnly(orden)}
                                                        title="Descargar plano técnico con medidas"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                        Plano
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="gap-2"
                                                        disabled={!orden.visita_tecnica_aprobada || generatingId === orden.id}
                                                        title={!orden.visita_tecnica_aprobada ? 'Primero aprueba la visita' : 'Generar en producción'}
                                                        onClick={() => handleGenerarProduccion(orden)}
                                                    >
                                                        {generatingId === orden.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        )}
                                                        Generar en Producción
                                                    </Button>
                                                    <Button
                                                        variant={orden.visita_tecnica_aprobada ? "default" : "outline"}
                                                        size="sm"
                                                        disabled={!orden.medidas_corregidas}
                                                        title={!orden.medidas_corregidas ? 'Primero completa la visita técnica' : ''}
                                                        onClick={() => orden.visita_tecnica_realizada && !orden.visita_tecnica_aprobada && handleAprobarTodosRealizados()}
                                                    >
                                                        {orden.visita_tecnica_aprobada ? '✓ Aprobada' : 'Aprobar'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>
            </Tabs>

            {/* Dialog de orden de visita - Exclusiva de Producción */}
            {visitaSeleccionada && (
                <OrdenVisitaDialog
                    open={!!visitaSeleccionada}
                    onOpenChange={(open) => !open && setVisitaSeleccionada(null)}
                    trabajoId={visitaSeleccionada.trabajo_id || null}
                    presupuestoId={visitaSeleccionada.id}
                    clienteNombre={visitaSeleccionada.cliente_nombre}
                    direccion={visitaSeleccionada.direccion}
                    coordenadas={visitaSeleccionada.coordenadas}
                    visitaRealizada={visitaSeleccionada.visita_tecnica_realizada}
                    aprobadoJefe={visitaSeleccionada.visita_tecnica_aprobada}
                    mode="produccion"
                    onSuccess={() => {
                        fetchOrdenes();
                        recargarOrdenes(); // Recargar Dashboard Taller
                        setVisitaSeleccionada(null);
                    }}
                />
            )}
        </div>
    );
}
