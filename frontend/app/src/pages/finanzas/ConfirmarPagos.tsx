import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Search, Filter, DollarSign, TrendingUp, AlertCircle,
  FileText, Download, Eye, Calendar, CreditCard, ChevronDown, ChevronUp, Loader2,
  CheckCircle2, Clock, Calendar as CalendarIcon, History, Archive, RefreshCcw
} from 'lucide-react';
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "../../components/common/DateRangePicker";
import { isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { PagoDialog } from './PagoDialog';
import { get, post, patch } from '../../api';
import { getDashboardStats, getPagosPresupuesto, type DashboardStats, type Pago } from '../../lib/finanzas/api';
import { toast } from 'sonner';

interface PresupuestoPago {
  id: string;
  /** Código comercial (ej. P00001) para comprobante de pago. */
  codigo?: string | null;
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
  fecha_vencimiento?: string;
  cant_pagos?: number;
  trabajo_id?: string;
  visita_tecnica_realizada?: boolean;
  aprobado_jefe_produccion?: boolean;
  visita_tecnica_aprobada?: boolean;
  medidas_corregidas?: boolean;
  fecha_visita_sugerida?: string;
  items?: { descripcion: string; cantidad: number; precio: number }[];
  archivado?: boolean;
}

export function ConfirmarPagos() {
  const [pagos, setPagos] = useState<PresupuestoPago[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [activeTab, setActiveTab] = useState('activos');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [sortOption, setSortOption] = useState('fecha_desc');
  const [pagoSeleccionado, setPagoSeleccionado] = useState<PresupuestoPago | null>(null);
  const [pagoEdicion, setPagoEdicion] = useState<{ presupuesto: PresupuestoPago; pago: Pago } | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [itemsByPresupuesto, setItemsByPresupuesto] = useState<Record<string, { descripcion: string; cantidad: number; precio: number }[]>>({});
  const [pagosByPresupuesto, setPagosByPresupuesto] = useState<Record<string, Pago[]>>({});
  const [loadingDetalle, setLoadingDetalle] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [presupuestosRes, statsRes] = await Promise.all([
        get<PresupuestoPago[]>(`/api/presupuestos?solo_finanzas=true&incluir_archivados=true`),
        getDashboardStats()
      ]);

      // Enriquecemos solo fechas para visualización
      const enrichedPagos = presupuestosRes.map(p => {
        const fechaCreacion = p.fecha_creacion || new Date().toISOString();
        const fechaVenc = new Date(fechaCreacion);
        fechaVenc.setDate(fechaVenc.getDate() + 30);

        return {
          ...p,
          fecha_creacion: fechaCreacion,
          fecha_vencimiento: p.fecha_vencimiento || fechaVenc.toISOString(),
          cant_pagos: p.cant_pagos ?? 0,
        };
      });

      setPagos(enrichedPagos);
      setStats(statsRes);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar datos financieros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cálculos de KPI
  const totalPresupuestado = stats?.total_presupuestado ?? pagos.reduce((sum, p) => sum + p.total, 0);
  const totalRecaudado = stats?.total_recaudado ?? pagos.reduce((sum, p) => sum + p.monto_cobrado, 0);
  const totalPendiente = stats?.total_pendiente ?? (totalPresupuestado - totalRecaudado);
  const porcentajeGlobal = totalPresupuestado > 0 ? (totalRecaudado / totalPresupuestado) * 100 : 0;

  const handlePagoSuccess = () => {
    toast.success("Pago registrado y balance actualizado");
    fetchData();
    setPagoSeleccionado(null);
    setPagoEdicion(null);
    if (expandedRow) {
      void loadDetallePresupuesto(expandedRow);
    }
  };

  const handleAceptarPresupuesto = async (item: PresupuestoPago) => {
    try {
      await post(`/api/presupuestos/${item.id}/aceptar`, {});
      toast.success("Presupuesto aceptado");
      fetchData();
    } catch (error) {
      toast.error("Error al aceptar presupuesto");
    }
  };
  const handleArchivarPresupuesto = async (item: PresupuestoPago) => {
    try {
      await patch(`/api/presupuestos/${item.id}/archivar`, {});
      toast.success("Presupuesto archivado");
      fetchData();
    } catch {
      toast.error("Error al archivar presupuesto");
    }
  };

  const handleReactivarPresupuesto = async (item: PresupuestoPago) => {
    try {
      await patch(`/api/presupuestos/${item.id}/reactivar`, {});
      toast.success("Presupuesto reactivado");
      fetchData();
    } catch {
      toast.error("Error al reactivar presupuesto");
    }
  };
  const loadDetallePresupuesto = async (presupuestoId: string) => {
    setLoadingDetalle(prev => ({ ...prev, [presupuestoId]: true }));
    try {
      const [detalle, pagosRegistrados] = await Promise.all([
        get<any>(`/api/presupuestos/${presupuestoId}`),
        getPagosPresupuesto(presupuestoId),
      ]);

      const lineas: any[] = Array.isArray(detalle?.lineas) ? detalle.lineas : [];
      const itemsLineas = lineas.map((l) => {
        const m2 = Number(l.metros_cuadrados || 0);
        const pu = Number(l.precio_unitario || 0);
        const extra = Number(l.recargo_extra || 0);
        const subtotal = m2 * pu + extra;
        const descParts = [l.material, l.medidas, m2 ? `${m2.toFixed(2)} m²` : ""].filter(Boolean);
        return { descripcion: descParts.join(" · "), cantidad: 1, precio: subtotal };
      });

      const extras = Array.isArray(detalle?.meta?.items_adicionales) ? detalle.meta.items_adicionales : [];
      const itemsExtras = extras.map((x: any) => {
        const cant = Number(x.cantidad || 1);
        const precio = Number(x.precio || 0);
        const total = cant * precio;
        return { descripcion: String(x.descripcion || "Extra"), cantidad: cant, precio: total };
      });

      setItemsByPresupuesto(prev => ({
        ...prev,
        [presupuestoId]: [...itemsLineas, ...itemsExtras],
      }));
      setPagosByPresupuesto(prev => ({ ...prev, [presupuestoId]: pagosRegistrados as Pago[] }));
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar detalle del presupuesto");
    } finally {
      setLoadingDetalle(prev => ({ ...prev, [presupuestoId]: false }));
    }
  };



  const toggleExpand = (id: string) => {
    const next = expandedRow === id ? null : id;
    setExpandedRow(next);
    if (next) {
      void loadDetallePresupuesto(next);
    }
  };

  const filteredPagos = pagos.filter(p => {
    // Filtro por Tab (Activos vs Historial)
    const isArchived = p.archivado;
    if (activeTab === 'activos' && isArchived) return false;
    if (activeTab === 'historial' && !isArchived) return false;

    const searchStr = filtro.toLowerCase();
    const clienteNombre = (p.cliente_nombre || '').toLowerCase();
    const id = (p.id || '').toLowerCase();
    const observaciones = (p.observaciones || '').toLowerCase();

    const matchesSearch = clienteNombre.includes(searchStr) ||
      id.includes(searchStr) ||
      observaciones.includes(searchStr);

    const matchesStatus = statusFilter === 'todos' ||
      (statusFilter === 'aprobado' && p.aceptado_venta) ||
      (statusFilter === 'pendiente_aceptacion' && !p.aceptado_venta) ||
      (statusFilter === 'pagado' && p.estado_pago === 'pagado') ||
      (statusFilter === 'pendiente_pago' && p.estado_pago !== 'pagado');

    let matchesDate = true;
    if (dateRange?.from) {
      if (!p.fecha_creacion) {
        matchesDate = false;
      } else {
        const fechaPlano = new Date(p.fecha_creacion);
        const start = startOfDay(dateRange.from!);
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from!);
        matchesDate = isWithinInterval(fechaPlano, { start, end });
      }
    }

    return matchesSearch && matchesDate && matchesStatus;
  }).sort((a, b) => {
    switch (sortOption) {
      case 'fecha_asc':
        return (new Date(a.fecha_creacion || 0).getTime() - new Date(b.fecha_creacion || 0).getTime()) || a.id.localeCompare(b.id);
      case 'cliente_asc':
        return (a.cliente_nombre || '').localeCompare(b.cliente_nombre || '') || a.id.localeCompare(b.id);
      case 'monto_desc':
        return (b.total - a.total) || a.id.localeCompare(b.id);
      case 'fecha_desc':
      default:
        // Orden de llegada (Newest first)
        return (new Date(b.fecha_creacion || 0).getTime() - new Date(a.fecha_creacion || 0).getTime()) || a.id.localeCompare(b.id);
    }
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-gray-500 animate-pulse">Cargando Mesa de Control...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. TARJETAS KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 font-medium uppercase">Total Presupuestado</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">${totalPresupuestado.toLocaleString()}</h3>
              </div>
              <div className="p-2 bg-blue-50 rounded-full"><FileText className="h-5 w-5 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 font-medium uppercase">Total Recaudado</p>
                <h3 className="text-2xl font-bold text-green-700 mt-1">${totalRecaudado.toLocaleString()}</h3>
                <span className="text-xs text-green-600 font-medium">Cobertura: {porcentajeGlobal.toFixed(1)}%</span>
              </div>
              <div className="p-2 bg-green-50 rounded-full"><TrendingUp className="h-5 w-5 text-green-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-l-4 border-l-red-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 font-medium uppercase">Pendiente de Cobro</p>
                <h3 className="text-2xl font-bold text-red-700 mt-1">${totalPendiente.toLocaleString()}</h3>
              </div>
              <div className="p-2 bg-red-50 rounded-full"><AlertCircle className="h-5 w-5 text-red-600" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. BARRA DE FILTROS */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por cliente, ID, descripción..."
            className="pl-8"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto items-center">
          <div className="w-[280px]">
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aprobado">Aprobados Venta</SelectItem>
              <SelectItem value="pendiente_aceptacion">Pendientes Venta</SelectItem>
              <SelectItem value="pagado">Pagado Total</SelectItem>
              <SelectItem value="pendiente_pago">Pendiente Pago</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortOption} onValueChange={setSortOption}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Orden" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fecha_desc">Más Recientes</SelectItem>
              <SelectItem value="fecha_asc">Más Antiguos</SelectItem>
              <SelectItem value="cliente_asc">Cliente (A-Z)</SelectItem>
              <SelectItem value="monto_desc">Mayor Monto</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" onClick={() => { setFiltro(''); setDateRange(undefined); setStatusFilter('todos'); setSortOption('fecha_desc'); }}>Limpiar</Button>
        </div>
      </div>

      {/* PESTAÑAS: ACTIVOS vs HISTORIAL */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="activos" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Activos
          </TabsTrigger>
          <TabsTrigger value="historial" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 3. MESA DE CONTROL (LISTADO DETALLADO) */}
      <div className="grid gap-4 mt-6">
        {filteredPagos.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No se encontraron resultados</h3>
            <p className="text-gray-500">Prueba ajustando los filtros de búsqueda.</p>
          </div>
        ) : (
          filteredPagos.map((item) => {
            const pct = Math.min(100, (item.monto_cobrado / item.total) * 100);
            const saldo = item.total - item.monto_cobrado;
            const isExpanded = expandedRow === item.id;
            const aceptado = !!item.aceptado_venta;

            const puedeCrearOT = aceptado && pct > 0 && item.visita_tecnica_aprobada;

            return (
              <Card key={item.id} className="hover:border-blue-300 transition-all border-l-4 border-l-transparent hover:border-l-blue-500 overflow-hidden shadow-sm">
                <CardContent className="p-5">
                  {/* CABECERA DE FILA */}
                  <div className="flex flex-col md:flex-row justify-between gap-4 mb-4 border-b border-dashed pb-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">#{item.id.slice(0, 8)}</span>
                        <h3 className="font-bold text-lg text-gray-800 truncate">{item.cliente_nombre}</h3>
                        <Badge className={aceptado ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                          {aceptado ? "ACEPTADO" : "PENDIENTE ACEPTACIÓN"}
                        </Badge>
                        <Badge className={item.estado_pago === 'pagado' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>
                          {item.estado_pago.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-gray-600 font-medium truncate">{item.observaciones || 'Sin descripción del proyecto'}</p>
                    </div>

                    {/* DATOS CLAVE (Fechas) */}
                    <div className="flex gap-4 md:gap-6 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg h-fit border shrink-0">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-400">Creado</span>
                        <span className="flex items-center gap-1 font-medium"><Calendar className="h-3 w-3" /> {item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-red-400">Vence</span>
                        <span className="flex items-center gap-1 text-red-600 font-medium"><AlertCircle className="h-3 w-3" /> {item.fecha_vencimiento ? new Date(item.fecha_vencimiento).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <div className="hidden sm:block">
                        <span className="block text-[10px] uppercase font-bold text-gray-400">Pagos</span>
                        <span className="flex items-center gap-1 font-medium"><CreditCard className="h-3 w-3" /> {item.cant_pagos} regs.</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

                    {/* COLUMNA IZQUIERDA: FINANZAS Y PROGRESO */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Progreso de Pago</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-green-700">${item.monto_cobrado.toLocaleString()}</span>
                            <span className="text-sm text-gray-400">/ ${item.total.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400 uppercase font-bold">Saldo Pendiente</p>
                          <span className={`text-xl font-black ${saldo > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            ${saldo.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* SLICE (BARRA) */}
                      <div className="relative h-5 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200 shadow-inner">
                        <div
                          className={`h-full transition-all duration-1000 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                          style={{ width: `${pct}%` }}
                        >
                          {pct > 15 && `${pct.toFixed(0)}% PAGADO`}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tighter">
                        <span className={pct > 0 ? 'text-green-600' : 'text-gray-400'}>
                          {pct > 0 ? '✓ SEÑA CUBIERTA' : '⚠ FALTA SEÑA'}
                        </span>
                        <span className={item.visita_tecnica_aprobada ? 'text-green-600' : 'text-gray-400'}>
                          {item.visita_tecnica_aprobada ? '✓ VISITA TÉCNICA OK' : '⚠ VISITA PENDIENTE'}
                        </span>
                      </div>
                    </div>

                    {/* COLUMNA DERECHA: BOTONERA DE ACCIÓN */}
                    <div className="flex flex-wrap justify-end gap-2 items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(item.id)}
                        className={`text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : ''}`}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                        {isExpanded ? 'Ocultar Desglose' : 'Ver Desglose'}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => setPagoSeleccionado(item)}
                        disabled={!aceptado || item.estado_pago === 'pagado'}
                      >
                        <DollarSign className="h-4 w-4 mr-1" /> Registrar Pago
                      </Button>

                      {!aceptado && (
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700"
                          onClick={() => handleAceptarPresupuesto(item)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Aceptar Presupuesto
                        </Button>
                      )}

                      <div className="text-xs text-gray-500 italic">
                        <p>El resto de la gestión se realiza en</p>
                        <p className="inline-block px-3 py-1 bg-blue-50 rounded border border-blue-200 font-medium text-gray-600">
                          Producción → Órdenes de Visita
                        </p>
                      </div>

                      {item.archivado ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleReactivarPresupuesto(item)}
                        >
                          <RefreshCcw className="h-4 w-4 mr-1" /> Reactivar
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          onClick={() => handleArchivarPresupuesto(item)}
                        >
                          <Archive className="h-4 w-4 mr-1" /> Archivar
                        </Button>
                      )}

                      <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-blue-500">
                        <Download className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  {/* DESGLOSE EXPANDIDO */}
                  {isExpanded && (() => {
                    const items = itemsByPresupuesto[item.id] ?? [];
                    const pagosRegistrados = pagosByPresupuesto[item.id] ?? [];
                    const isDetalleLoading = !!loadingDetalle[item.id];

                    return (
                      <div className="mt-6 pt-6 border-t animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-gray-50 rounded-lg p-4 space-y-6">
                          <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <FileText className="h-3 w-3" /> Detalle de Ítems en Presupuesto
                            </h4>
                            {isDetalleLoading ? (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cargando detalle...
                              </div>
                            ) : items.length === 0 ? (
                              <div className="text-sm text-gray-500">Sin ítems cargados.</div>
                            ) : (
                              <div className="space-y-2">
                                {items.map((line, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-white p-3 rounded border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="h-8 w-8 bg-blue-50 rounded flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                                        {line.cantidad}x
                                      </div>
                                      <span className="font-medium text-gray-700 truncate">{line.descripcion}</span>
                                    </div>
                                    <span className="font-mono font-bold text-gray-900">${line.precio.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <CreditCard className="h-3 w-3" /> Pagos Registrados
                            </h4>
                            {isDetalleLoading ? (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cargando pagos...
                              </div>
                            ) : pagosRegistrados.length === 0 ? (
                              <div className="text-sm text-gray-500">Sin pagos registrados.</div>
                            ) : (
                              <div className="space-y-2">
                                {pagosRegistrados.map((p) => (
                                  <div key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white p-3 rounded border border-gray-100 shadow-sm">
                                    <div className="min-w-0">
                                      <div className="font-medium text-gray-800">${Number(p.monto).toLocaleString()}</div>
                                      <div className="text-xs text-gray-500">
                                        {p.metodo_pago}{p.referencia ? ` · ${p.referencia}` : ""}{p.fecha ? ` · ${new Date(p.fecha).toLocaleString()}` : ""}
                                      </div>
                                      {p.nota && <div className="text-xs text-gray-500 mt-1">{p.nota}</div>}
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPagoEdicion({ presupuesto: item, pago: p })}
                                      >
                                        Editar
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/50 p-4 rounded-lg border border-dashed border-gray-300">
                            <div className="flex gap-4">
                              <div className="text-center">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Estado Técnico</p>
                                <div className="flex items-center gap-1 mt-1">
                                  {item.visita_tecnica_realizada ? (
                                    <Badge className="bg-green-100 text-green-700 border-green-200">
                                      <CheckCircle2 className="h-3 w-3 mr-1" /> VISITA OK
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-amber-600 border-amber-200">
                                      <Clock className="h-3 w-3 mr-1" /> PENDIENTE
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Estado Financiero</p>
                                <div className="flex items-center gap-1 mt-1">
                                  {pct > 0 ? (
                                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                      <DollarSign className="h-3 w-3 mr-1" /> SEÑA OK
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-red-600 border-red-200">
                                      <AlertCircle className="h-3 w-3 mr-1" /> SIN SEÑA
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <Button variant="link" className="text-blue-600 font-bold h-auto p-0 flex items-center gap-1">
                              Ir al expediente completo <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {
        pagoSeleccionado && (
          <PagoDialog
            open={!!pagoSeleccionado}
            onOpenChange={(open) => !open && setPagoSeleccionado(null)}
            presupuestoId={pagoSeleccionado.id}
            clienteId={pagoSeleccionado.cliente_id}
            clienteNombre={pagoSeleccionado.cliente_nombre}
            presupuestoDisplay={pagoSeleccionado.codigo?.trim() || pagoSeleccionado.id}
            totalPresupuesto={pagoSeleccionado.total}
            saldoPendiente={pagoSeleccionado.total - pagoSeleccionado.monto_cobrado}
            onPagoSuccess={handlePagoSuccess}
          />
        )
      }

      {
        pagoEdicion && (
          <PagoDialog
            open={!!pagoEdicion}
            onOpenChange={(open) => !open && setPagoEdicion(null)}
            pagoId={pagoEdicion.pago.id}
            initialPago={{
              monto: pagoEdicion.pago.monto,
              metodo_pago: pagoEdicion.pago.metodo_pago,
              referencia: pagoEdicion.pago.referencia,
              nota: pagoEdicion.pago.nota,
              fecha: pagoEdicion.pago.fecha,
            }}
            presupuestoId={pagoEdicion.presupuesto.id}
            clienteId={pagoEdicion.presupuesto.cliente_id}
            clienteNombre={pagoEdicion.presupuesto.cliente_nombre}
            presupuestoDisplay={pagoEdicion.presupuesto.codigo?.trim() || pagoEdicion.presupuesto.id}
            totalPresupuesto={pagoEdicion.presupuesto.total}
            saldoPendiente={(pagoEdicion.presupuesto.total - pagoEdicion.presupuesto.monto_cobrado) + pagoEdicion.pago.monto}
            onPagoSuccess={handlePagoSuccess}
          />
        )
      }

    </div >
  );
}
