import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { notifySuccess, notifyError } from '../../utils/notifications';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Truck,
  Calendar,
  MapPin,
  CheckCircle2,
  Star,
  Image as ImageIcon,
  MessageSquare,
  Loader2,
  Clock,
  Navigation,
  ExternalLink,
  Search,
  Filter
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { get, patch, post } from '../../api';
import { format } from 'date-fns';

interface Entrega {
  id: string;
  cliente: string;
  material_nombre: string;
  estado_produccion: string;
  estado_logistica: string;
  fecha_entrega_programada: string | null;
  calificacion_calidad: number | null;
  comentarios_calidad: string | null;
  fotos_calidad_url: string | null;
  prioridad: string;
  direccion: string;
  pagado: boolean;
  listo_para_entrega: boolean;
  total_piezas: number;
  piezas_cortadas: number;
  tiene_encuesta: boolean;
  encuesta_completada: boolean;
  encuesta_fecha: string | null;
  encuesta_conformidad: boolean | null;
  encuesta_calificacion: number | null;
  piezas: Array<{
    id: string;
    nombre: string;
    material: string;
    medidas: string;
    estado: string;
    icono: string;
  }>;
}

export function DashboardEntregas() {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'activas' | 'historial'>('activas');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [entregaParaFeedback, setEntregaParaFeedback] = useState<Entrega | null>(null);

  // Feedback form state
  const [rating, setRating] = useState(0);
  const [comentarios, setComentarios] = useState('');
  const [fotosUrl, setFotosUrl] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [direccionInputs, setDireccionInputs] = useState<Record<string, string>>({});
  const [mapaAbierto, setMapaAbierto] = useState<Record<string, boolean>>({});

  const fetchEntregas = async () => {
    setLoading(true);
    try {
      const data = await get<Entrega[]>('/api/logistica/entregas');
      setEntregas(data);
    } catch (err) {
      notifyError('Error al cargar las entregas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntregas();
  }, []);

  const handleUpdateStatus = async (entregaId: string, nuevoEstado: string) => {
    try {
      await patch(`/api/logistica/entregas/${entregaId}/estado`, { estado_logistica: nuevoEstado });
      notifySuccess(`Estado actualizado a ${nuevoEstado}`);

      if (nuevoEstado === 'entregada') {
        const entrega = entregas.find(e => e.id === entregaId);
        if (entrega) {
          setEntregaParaFeedback(entrega);
          setFeedbackDialogOpen(true);
          setRating(0);
          setComentarios('');
          setFotosUrl('');
        }
      }

      fetchEntregas();
    } catch (err) {
      notifyError('Error al actualizar el estado');
    }
  };

  const handleSubmitFeedback = async () => {
    if (!entregaParaFeedback || rating === 0) {
      notifyError('Por favor selecciona una calificación');
      return;
    }

    setSubmittingFeedback(true);
    try {
      await post(`/api/logistica/entregas/${entregaParaFeedback.id}/feedback`, {
        calificacion: rating,
        comentarios,
        fotos_url: fotosUrl
      });
      notifySuccess('Feedback registrado correctamente');
      setFeedbackDialogOpen(false);
      fetchEntregas();
    } catch (err) {
      notifyError('Error al registrar el feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const getDireccionValue = (entrega: Entrega) => {
    return direccionInputs[entrega.id] ?? entrega.direccion ?? '';
  };

  const guardarDireccion = async (entregaId: string) => {
    const direccion = (direccionInputs[entregaId] || '').trim();
    if (!direccion) {
      notifyError('La dirección no puede estar vacía');
      return;
    }

    try {
      await patch(`/api/logistica/entregas/${entregaId}/direccion`, { direccion });
      notifySuccess('Dirección actualizada');
      fetchEntregas();
    } catch (err) {
      notifyError('Error al actualizar la dirección');
    }
  };

  const toggleMapa = (entregaId: string) => {
    setMapaAbierto((prev) => ({ ...prev, [entregaId]: !prev[entregaId] }));
  };

  const abrirMapa = (direccion: string) => {
    if (!direccion) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
    window.open(url, '_blank', 'noopener');
  };

  // Filtrado de listas
  const entregasActivas = useMemo(() => entregas.filter(e => e.estado_logistica !== 'entregada'), [entregas]);
  const entregasHistorial = useMemo(() => entregas.filter(e => e.estado_logistica === 'entregada'), [entregas]);
  const listaMostrar = useMemo(() => {
    return entregas.filter(e => {
      // 1. Filtro principal (Tabs: activas vs historial)
      const isEntregada = e.estado_logistica === 'entregada';
      if (filtro === 'activas' && isEntregada) return false;
      if (filtro === 'historial' && !isEntregada) return false;

      // 2. Búsqueda por texto (Cliente, ID, Dirección, Material)
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        e.cliente.toLowerCase().includes(term) ||
        e.id.toLowerCase().includes(term) ||
        e.direccion.toLowerCase().includes(term) ||
        e.material_nombre.toLowerCase().includes(term);

      // 3. Filtro por Fecha (Fecha de entrega programada)
      const matchesDate = !dateFilter || (e.fecha_entrega_programada && e.fecha_entrega_programada.startsWith(dateFilter));

      // 4. Filtro por Estado específico
      const matchesStatus = statusFilter === 'all' || e.estado_logistica === statusFilter;

      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [entregas, filtro, searchTerm, dateFilter, statusFilter]);

  return (
    <div className="h-full flex flex-col bg-background p-6">
      <PageHeader
        icon={Truck}
        title="Logística y Entregas"
        description="Gestión de rutas, despachos y satisfacción del cliente."
      />

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as any)} className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <TabsList>
            <TabsTrigger value="activas" className="gap-2">
              <Truck className="h-4 w-4" />
              Entregas Activas
              <Badge variant="secondary" className="ml-1 text-xs">{entregasActivas.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="historial" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Historial
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-lg border shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por cliente, ID, dirección..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto items-center">
            <Input
              type="date"
              className="w-auto"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_camino">En Camino</SelectItem>
                <SelectItem value="entregada">Entregada</SelectItem>
                <SelectItem value="reprogramada">Reprogramada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3 max-w-7xl">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {listaMostrar.length === 0 && (
                <div className="text-center py-12 text-gray-500 bg-gradient-to-b from-gray-50 to-white rounded-lg border border-dashed">
                  <Truck className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-lg font-medium">No hay entregas en esta sección</p>
                </div>
              )}

              {listaMostrar.map((entrega) => (
                <Card key={entrega.id} className="overflow-hidden border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                  <CardContent className="p-6 space-y-4">
                    {/* ENCABEZADO - DATOS PRINCIPALES */}
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className="font-mono text-xs bg-gray-100">{entrega.id.slice(0, 8).toUpperCase()}</Badge>
                          <h3 className="font-bold text-xl text-gray-900">{entrega.cliente}</h3>
                          {entrega.prioridad === 'alta' && (
                            <Badge variant="destructive" className="animate-pulse">⚡ Alta Prioridad</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 ml-0">📦 {entrega.material_nombre}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {entrega.estado_logistica === 'en_ruta' && (
                          <Badge className="bg-blue-100 text-blue-900 font-semibold">
                            <Truck className="h-3 w-3 mr-1" /> En Ruta
                          </Badge>
                        )}
                        {entrega.estado_logistica === 'entregada' && (
                          <Badge className="bg-green-100 text-green-900 font-semibold">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Entregada
                          </Badge>
                        )}
                        {entrega.estado_logistica === 'pendiente' && (
                          <Badge variant="secondary" className="font-semibold">⏳ Pendiente</Badge>
                        )}
                        {entrega.estado_logistica === 'programada' && (
                          <Badge className="bg-purple-100 text-purple-900 font-semibold">📅 Programada</Badge>
                        )}
                      </div>
                    </div>

                    <Separator className="my-2" />

                    {/* SECCIÓN DE DIRECCIÓN E INFO*/}
                    <div className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-lg border border-gray-200 space-y-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <span className="font-medium text-gray-700">Dirección de Entrega</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            value={getDireccionValue(entrega)}
                            onChange={(e) => setDireccionInputs({ ...direccionInputs, [entrega.id]: e.target.value })}
                            onBlur={() => guardarDireccion(entrega.id)}
                            placeholder="Dirección de entrega"
                            className="h-10 flex-1"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => guardarDireccion(entrega.id)} className="min-w-fit">
                              Guardar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => abrirMapa(getDireccionValue(entrega))}
                              disabled={!getDireccionValue(entrega)}
                              className="min-w-fit"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleMapa(entrega.id)}
                              disabled={!getDireccionValue(entrega)}
                            >
                              {mapaAbierto[entrega.id] ? '🗺️ Ocultar' : '🗺️ Ver'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {mapaAbierto[entrega.id] && getDireccionValue(entrega) && (
                        <div className="w-full h-40 rounded border overflow-hidden">
                          <iframe
                            title={`Mapa ${entrega.id}`}
                            width="100%"
                            height="100%"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(getDireccionValue(entrega))}&z=15&output=embed`}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-purple-500" />
                          <span className="text-xs"><span className="font-medium">Entrega:</span> {entrega.fecha_entrega_programada ? format(new Date(entrega.fecha_entrega_programada + 'T00:00:00'), 'dd/MM') : '📅 Pendiente'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <span className="text-xs"><span className="font-medium">Prod:</span> {entrega.estado_produccion}</span>
                        </div>
                        {entrega.pagado && (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-xs font-medium">Pagado ✓</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PIEZAS A ENTREGAR */}
                    {entrega.piezas && entrega.piezas.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-800">📦 Piezas a Entregar ({entrega.piezas.length})</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                          {entrega.piezas.map((pieza) => (
                            <div
                              key={pieza.id}
                              className="flex items-start gap-2 p-3 bg-gradient-to-r from-blue-50 to-transparent rounded border border-blue-100 hover:border-blue-300 transition"
                            >
                              <span className="text-lg min-w-[24px]">{pieza.icono}</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 text-sm">{pieza.nombre}</div>
                                <div className="text-xs text-gray-600 truncate">
                                  {pieza.material} • {pieza.medidas}
                                </div>
                                <Badge variant="outline" className="text-xs mt-1 bg-white">
                                  {pieza.estado}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ACCIONES Y FEEDBACK */}
                    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center lg:justify-between pt-2 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        {entrega.estado_logistica === 'entregada' && entrega.calificacion_calidad ? (
                          <div className="flex items-center gap-3 bg-gradient-to-r from-green-50 to-transparent p-3 rounded-lg border border-green-200 flex-1">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 ${star <= (entrega.calificacion_calidad || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                />
                              ))}
                            </div>
                            <div className="text-sm">
                              <span className="font-medium text-green-900">Calidad Verificada</span>
                              {entrega.comentarios_calidad && <p className="text-xs text-green-700 italic">"{entrega.comentarios_calidad}"</p>}
                            </div>
                          </div>
                        ) : entrega.estado_logistica === 'entregada' ? (
                          <div className="text-sm text-gray-600 flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span>Entregada</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex gap-2 flex-wrap lg:flex-nowrap">
                        {entrega.estado_logistica === 'pendiente' && (
                          <Button
                            onClick={() => handleUpdateStatus(entrega.id, 'programada')}
                            className="flex-1 lg:flex-none"
                          >
                            <Calendar className="mr-2 h-4 w-4" /> Programar
                          </Button>
                        )}

                        {entrega.estado_logistica === 'programada' && (
                          <Button
                            className="flex-1 lg:flex-none bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleUpdateStatus(entrega.id, 'en_ruta')}
                          >
                            <Navigation className="mr-2 h-4 w-4" /> En Ruta
                          </Button>
                        )}

                        {entrega.estado_logistica === 'en_ruta' && (
                          <Button
                            className="flex-1 lg:flex-none bg-green-600 hover:bg-green-700"
                            onClick={() => handleUpdateStatus(entrega.id, 'entregada')}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Entregar
                          </Button>
                        )}

                        {entrega.estado_logistica === 'entregada' && !entrega.calificacion_calidad && (
                          <Button
                            variant="outline"
                            className="flex-1 lg:flex-none"
                            onClick={() => {
                              setEntregaParaFeedback(entrega);
                              setFeedbackDialogOpen(true);
                            }}
                          >
                            <Star className="mr-2 h-4 w-4 text-yellow-500" /> Calificar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </Tabs>

      {/* Modal de Feedback de Calidad */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Star className="h-6 w-6 text-yellow-500 fill-current" />
              Control de Calidad
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">¿Cómo calificaría el cliente la instalación para <strong>{entregaParaFeedback?.cliente}</strong>?</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => setRating(num)}
                    className="hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`h-10 w-10 ${num <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-slate-500" />
                  Fotos de la Instalación (Link Drive)
                </Label>
                <Input
                  placeholder="https://drive.google.com/..."
                  value={fotosUrl}
                  onChange={(e) => setFotosUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-slate-500" />
                  Comentarios / Notas
                </Label>
                <Textarea
                  placeholder="Detalles sobre la entrega o instalación..."
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFeedbackDialogOpen(false)}
              disabled={submittingFeedback}
            >
              Omitir por ahora
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={submittingFeedback || rating === 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submittingFeedback ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Feedback'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}