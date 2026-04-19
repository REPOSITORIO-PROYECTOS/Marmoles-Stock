import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { notifySuccess, notifyError } from '../../utils/notifications';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
    Truck,
    MapPin,
    CheckCircle2,
    Star,
    MessageSquare,
    Loader2,
    Copy,
    Phone,
    Package,
    AlertCircle,
    Search
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { get, patch, post } from '../../api';

interface Entrega {
    id: string;
    cliente: string;
    material_nombre: string;
    estado_produccion: string;
    estado_logistica: string;
    fecha_entrega_programada: string | null;
    calificacion_calidad: number | null;
    comentarios_calidad: string | null;
    direccion: string;
    pagado: boolean;
    total_piezas: number;
    piezas_cortadas: number;
    piezas_entregadas?: number;
    entrega_completa?: boolean;
    encuesta_token: string | null;
    encuesta_completada: boolean;
    prioridad: string;
    piezas: Array<{
        id: string;
        nombre: string;
        material: string;
        medidas: string;
        estado: string;
        entregada?: boolean;
        icono: string;
    }>;
}

export function DashboardEntregasSimplificado() {
    const [entregas, setEntregas] = useState<Entrega[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState<'activas' | 'entregadas'>('activas');
    const [searchTerm, setSearchTerm] = useState('');
    const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
    const [entregaParaFeedback, setEntregaParaFeedback] = useState<Entrega | null>(null);
    const [rating, setRating] = useState(0);
    const [comentarios, setComentarios] = useState('');
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const [seleccionPiezas, setSeleccionPiezas] = useState<Record<string, string[]>>({});

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
                comentarios
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

    const togglePieza = (entregaId: string, piezaId: string, checked: boolean) => {
        setSeleccionPiezas((prev) => {
            const current = new Set(prev[entregaId] || []);
            if (checked) current.add(piezaId);
            else current.delete(piezaId);
            return { ...prev, [entregaId]: Array.from(current) };
        });
    };

    const seleccionarTodasListas = (entrega: Entrega) => {
        const listas = (entrega.piezas || [])
            .filter((p) => ['cortada', 'pulida', 'terminada'].includes(p.estado) && !p.entregada)
            .map((p) => p.id);
        setSeleccionPiezas((prev) => ({ ...prev, [entrega.id]: listas }));
    };

    const entregarPiezasListas = async (entrega: Entrega) => {
        const ids = seleccionPiezas[entrega.id] || [];
        if (!ids.length) {
            notifyError('Seleccione al menos una pieza lista para entregar');
            return;
        }
        try {
            await patch(`/api/logistica/entregas/${entrega.id}/entregar-piezas`, { pieza_ids: ids });
            notifySuccess('Piezas entregadas correctamente');
            setSeleccionPiezas((prev) => ({ ...prev, [entrega.id]: [] }));
            fetchEntregas();
        } catch {
            notifyError('Error al registrar la entrega de piezas');
        }
    };

    // Generar link de encuesta y WhatsApp
    const generarLinkWhatsApp = (entrega: Entrega) => {
        if (!entrega.encuesta_token) {
            notifyError('La encuesta no ha sido generada aún');
            return '';
        }
        const mensaje = `Hola ${entrega.cliente}, tu pedido está listo. Completa la encuesta aquí: ${window.location.origin}/encuesta/${entrega.encuesta_token}`;
        const encoded = encodeURIComponent(mensaje);
        return `https://wa.me/?text=${encoded}`;
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            notifySuccess('Link copiado al portapapeles');
        } catch (err) {
            notifyError('Error al copiar el link');
        }
    };

    // Filtrar entregas
    const listaFiltrada = useMemo(() => {
        return entregas.filter(e => {
            const isEntregada = e.estado_logistica === 'entregada';
            if (filtro === 'activas' && isEntregada) return false;
            if (filtro === 'entregadas' && !isEntregada) return false;

            const term = searchTerm.toLowerCase();
            return (
                e.cliente.toLowerCase().includes(term) ||
                e.id.toLowerCase().includes(term) ||
                e.direccion.toLowerCase().includes(term) ||
                e.material_nombre.toLowerCase().includes(term)
            );
        });
    }, [entregas, filtro, searchTerm]);

    return (
        <div className="h-full flex flex-col bg-background p-4 md:p-6">
            <PageHeader
                icon={Truck}
                title="Entregas - Vista Simplificada"
                description="Gestioná entregas de forma fácil y rápida"
            />

            {/* Filtros */}
            <div className="space-y-4 mb-6">
                <Tabs value={filtro} onValueChange={(v) => setFiltro(v as any)}>
                    <TabsList className="grid w-full md:w-auto grid-cols-2">
                        <TabsTrigger value="activas" className="gap-2">
                            <Truck className="h-4 w-4" />
                            Activas
                        </TabsTrigger>
                        <TabsTrigger value="entregadas" className="gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Entregadas
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Buscar cliente, dirección, material..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Lista de entregas */}
            <div className="flex-1 overflow-y-auto space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : listaFiltrada.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="p-6 text-center text-gray-500">
                            <Truck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p className="text-base font-medium">No hay entregas en esta sección</p>
                        </CardContent>
                    </Card>
                ) : (
                    listaFiltrada.map((entrega) => (
                        <Card key={entrega.id} className="border-l-4 border-l-cyan-500 overflow-hidden">
                            <CardContent className="p-4 space-y-3">
                                {/* Encabezado */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant="outline" className="font-mono text-xs">
                                                {entrega.id.slice(0, 8).toUpperCase()}
                                            </Badge>
                                            <h3 className="font-bold text-base truncate">{entrega.cliente}</h3>
                                            {entrega.prioridad === 'alta' && (
                                                <Badge variant="destructive" className="text-xs">⚡ Alta</Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1">📦 {entrega.material_nombre}</p>
                                    </div>
                                    <div className="text-right">
                                        {entrega.estado_logistica === 'entregada' && (
                                            <Badge className="bg-green-600">Entregada ✓</Badge>
                                        )}
                                        {entrega.estado_logistica === 'en_ruta' && (
                                            <Badge className="bg-cyan-600">En Ruta</Badge>
                                        )}
                                        {entrega.estado_logistica !== 'entregada' && entrega.estado_logistica !== 'en_ruta' && (
                                            <Badge variant="secondary">Pendiente</Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Dirección */}
                                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900">Dirección</p>
                                            <p className="text-sm text-gray-700 break-words">{entrega.direccion || 'Sin dirección'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Piezas a entregar (resumen) */}
                                {entrega.piezas && entrega.piezas.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium text-gray-800">
                                                📦 Piezas ({entrega.piezas_entregadas || 0}/{entrega.total_piezas})
                                            </p>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="text-xs"
                                                onClick={() => seleccionarTodasListas(entrega)}
                                            >
                                                Seleccionar listas
                                            </Button>
                                        </div>
                                        <div className="space-y-1 max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
                                            {entrega.piezas.map((pieza) => {
                                                const lista = ['cortada', 'pulida', 'terminada'].includes(pieza.estado);
                                                const disabled = !lista || !!pieza.entregada;
                                                const checked = (seleccionPiezas[entrega.id] || []).includes(pieza.id);
                                                return (
                                                    <label key={pieza.id} className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${disabled ? 'opacity-60' : 'hover:bg-white cursor-pointer'}`}>
                                                        <input
                                                            type="checkbox"
                                                            disabled={disabled}
                                                            checked={checked}
                                                            onChange={(e) => togglePieza(entrega.id, pieza.id, e.target.checked)}
                                                        />
                                                        <span className="font-medium">{pieza.nombre}</span>
                                                        <span className="text-gray-600">{pieza.medidas}</span>
                                                        {pieza.entregada && <Badge className="ml-auto bg-green-600">Entregada</Badge>}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Acciones */}
                                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                                    {entrega.estado_logistica === 'pendiente' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleUpdateStatus(entrega.id, 'en_ruta')}
                                            className="flex-1 md:flex-none text-xs"
                                        >
                                            <Truck className="h-3 w-3 mr-1" /> En Ruta
                                        </Button>
                                    )}

                                    {entrega.estado_logistica === 'en_ruta' && (
                                        <Button
                                            size="sm"
                                            className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-xs"
                                            onClick={() => handleUpdateStatus(entrega.id, 'entregada')}
                                        >
                                            <CheckCircle2 className="h-3 w-3 mr-1" /> Entregar
                                        </Button>
                                    )}

                                    {entrega.estado_logistica !== 'entregada' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => entregarPiezasListas(entrega)}
                                            className="flex-1 md:flex-none text-xs"
                                            disabled={(seleccionPiezas[entrega.id] || []).length === 0}
                                        >
                                            <Package className="h-3 w-3 mr-1" /> Entregar piezas listas
                                        </Button>
                                    )}

                                    {entrega.encuesta_token && !entrega.encuesta_completada && (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    const link = generarLinkWhatsApp(entrega);
                                                    window.open(link, '_blank');
                                                }}
                                                className="flex-1 md:flex-none text-xs"
                                                title="Enviar encuesta por WhatsApp"
                                            >
                                                <Phone className="h-3 w-3 mr-1" /> WhatsApp
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    const link = `${window.location.origin}/encuesta/${entrega.encuesta_token}`;
                                                    copyToClipboard(link);
                                                }}
                                                className="flex-1 md:flex-none text-xs"
                                                title="Copiar link de encuesta"
                                            >
                                                <Copy className="h-3 w-3 mr-1" /> Link
                                            </Button>
                                        </>
                                    )}

                                    {entrega.estado_logistica === 'entregada' && !entrega.calificacion_calidad && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setEntregaParaFeedback(entrega);
                                                setFeedbackDialogOpen(true);
                                            }}
                                            className="flex-1 md:flex-none text-xs"
                                        >
                                            <Star className="h-3 w-3 mr-1" /> Calificar
                                        </Button>
                                    )}

                                    {entrega.calificacion_calidad && (
                                        <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                            <CheckCircle2 className="h-3 w-3" /> Calificada
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Modal de Feedback */}
            <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
                <DialogContent className="w-full max-w-sm p-4 md:p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg md:text-xl flex items-center gap-2">
                            <Star className="h-5 w-5 text-yellow-500" />
                            Calificar Entrega
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="text-center space-y-3">
                            <p className="text-sm text-gray-600">
                                ¿Cómo calificaría la entrega para <strong>{entregaParaFeedback?.cliente}</strong>?
                            </p>
                            <div className="flex justify-center gap-1">
                                {[1, 2, 3, 4, 5].map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => setRating(num)}
                                        className="hover:scale-110 transition-transform active:scale-100"
                                    >
                                        <Star
                                            className={`h-8 w-8 ${num <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                Comentarios (opcional)
                            </Label>
                            <Textarea
                                placeholder="Detalles sobre la entrega..."
                                value={comentarios}
                                onChange={(e) => setComentarios(e.target.value)}
                                rows={2}
                                className="text-sm"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setFeedbackDialogOpen(false)}
                            disabled={submittingFeedback}
                            className="text-sm"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSubmitFeedback}
                            disabled={submittingFeedback || rating === 0}
                            className="bg-green-600 hover:bg-green-700 text-sm"
                        >
                            {submittingFeedback ? (
                                <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                'Confirmar'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
