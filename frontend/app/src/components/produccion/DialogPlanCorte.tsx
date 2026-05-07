import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { PlanchaMapa } from './PlanchaMapa';
import { AlertTriangle, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { generatePlanLocal, prioritizeMedidas, type Pieza, type TrabajoPendiente } from '../../lib/produccion/plan';

interface DialogPlanCorteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    dialogData: {
        key: string;
        piezas: Pieza[];
        material: string;
        trabajos: TrabajoPendiente[]
    } | null;
    onCrearLote: (key: string, trabajos: TrabajoPendiente[]) => void;
    onEliminarTrabajo: (trabajoId: string) => void;
    grupos?: Array<{ key: string; trabajos: TrabajoPendiente[] }>;
    setDialogData?: (data: any) => void;
}

export function DialogPlanCorte({
    open,
    onOpenChange,
    dialogData,
    onCrearLote,
    onEliminarTrabajo,
    grupos,
    setDialogData
}: DialogPlanCorteProps) {
    const [estrategia, setEstrategia] = useState<"bestfit" | "shelf">("bestfit");

    if (!dialogData) return null;

    const puedeAprobar = dialogData.trabajos.every(t =>
        t.visita_tecnica && t.sena_abonada && t.aprobado_jefe
    );

    const handleCorteRapido = async () => {
        setEstrategia("shelf");
        if (dialogData && setDialogData && grupos) {
            const clienteName = dialogData.trabajos[0]?.cliente;
            if (clienteName) {
                const todosLosTrabajos = grupos
                    .flatMap(g => g.trabajos)
                    .filter(t => t.cliente === clienteName);
                if (todosLosTrabajos.length > dialogData.trabajos.length) {
                    toast.info(`${todosLosTrabajos.length} trabajos de ${clienteName} agregados (corte rápido)`);
                    setDialogData({
                        ...dialogData,
                        trabajos: todosLosTrabajos,
                        piezas: todosLosTrabajos.flatMap(t => t.piezas)
                    });
                }
            }
        }
    };

    const planLocal = generatePlanLocal(140, 280, dialogData.piezas, estrategia);
    const medidasPriorizadas = prioritizeMedidas(dialogData.piezas);

    // Calcular retazo automáticamente
    const planchaArea = 140 * 280; // cm²
    const areaUtilizada = planLocal.placements.reduce((sum, p) => sum + (p.pieza.ancho * p.pieza.largo * (p.pieza.cantidad || 1)), 0);
    const areaRetazo = planchaArea - areaUtilizada;
    const retazoAncho = 140; // Ancho de la plancha
    const retazoAlto = Math.ceil(areaRetazo / retazoAncho); // Alto calculado del retazo

    const handleImprimirYCrearLote = async () => {
        try {
            // Crear el lote antes de imprimir
            await onCrearLote(dialogData.key, dialogData.trabajos);
            toast.success(`Lote ${dialogData.key} creado exitosamente`);

            // Dar tiempo para que se actualice el backend
            setTimeout(() => {
                window.print();
            }, 500);
        } catch (error: any) {
            console.error(error);
            toast.error("Error al crear el lote: " + (error.message || "Error desconocido"));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[min(96vw,1100px)] max-h-[85vh] overflow-hidden p-0">
                <DialogHeader className="px-6 pt-6 pb-2 border-b">
                    <DialogTitle className="truncate">
                        Mapa de plancha · {dialogData.material} · {dialogData.key}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 px-6 py-4 overflow-y-auto">
                    {!puedeAprobar && (
                        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Advertencia: Este lote incluye trabajos que no cumplen la Regla de Oro. La planificación será rechazada por el servidor.</span>
                        </div>
                    )}

                    <div className="flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 py-2 z-10">
                        <Button
                            variant={estrategia === "bestfit" ? "default" : "outline"}
                            onClick={() => setEstrategia("bestfit")}
                        >
                            Eficiencia alta (menos desperdicio)
                        </Button>
                        <Button
                            variant={estrategia === "shelf" ? "default" : "outline"}
                            onClick={handleCorteRapido}
                        >
                            Corte rápido (todos del cliente)
                        </Button>
                        <div className="ml-auto text-sm text-muted-foreground">
                            {dialogData.material} · {dialogData.key}
                        </div>
                    </div>

                    <PlanchaMapa
                        width={140}
                        height={280}
                        piezas={dialogData.piezas}
                        strategy={estrategia}
                    />

                    {/* Lista de trabajos */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4" /> Trabajos en este Lote ({dialogData.trabajos.length})
                        </h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {dialogData.trabajos.map((t, trabajoIdx) => {
                                const piezasParaMostrar = t.piezas_data || t.piezas || [];
                                const totalPiezas = piezasParaMostrar.reduce((sum, p) => sum + (p.cantidad || p.qty || 0), 0);
                                return (
                                    <div key={t.id} className="p-3 border rounded-md bg-muted/30 relative group min-w-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1 pr-6">
                                                <p className="text-xs font-bold truncate">{t.cliente}</p>
                                                <p className="text-xs text-muted-foreground">ID: {t.id.substring(0, 8)}</p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-red-400 hover:text-red-600 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => {
                                                    if (confirm(`¿Eliminar ${t.cliente} de este lote?`)) {
                                                        if (setDialogData) {
                                                            setDialogData({
                                                                ...dialogData,
                                                                trabajos: dialogData.trabajos.filter(tr => tr.id !== t.id),
                                                                piezas: dialogData.piezas.filter(p => !t.piezas.some(tp => tp.id === p.id))
                                                            });
                                                        }
                                                    }
                                                }}
                                                title="Eliminar del lote"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>

                                        {/* Piezas del trabajo */}
                                        {piezasParaMostrar.length > 0 ? (
                                            <div className="space-y-1 mb-2">
                                                <p className="text-xs font-medium text-muted-foreground">Piezas ({totalPiezas} u):</p>
                                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                                    {piezasParaMostrar.map((pieza, idx) => {
                                                        const ancho = pieza.ancho || pieza.w || 0;
                                                        const largo = pieza.largo || pieza.h || 0;
                                                        const cant = pieza.cantidad || pieza.qty || 0;
                                                        const desc = pieza.descripcion || pieza.nombre || `Pieza ${idx + 1}`;
                                                        return (
                                                            <div key={idx} className="text-xs bg-background/50 px-2 py-1 rounded">
                                                                <span className="font-bold text-blue-600">{t.cliente} - Pieza {idx + 1}</span>
                                                                <span className="font-mono ml-2">{largo}×{ancho} cm</span>
                                                                <span className="text-muted-foreground"> × {cant} u</span>
                                                                {desc && pieza.descripcion && <span className="text-muted-foreground ml-1">· {desc}</span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-amber-600 mb-2">⚠️ Sin piezas definidas</p>
                                        )}

                                        {/* Archivos adjuntos */}
                                        {((t.archivos_adjuntos && t.archivos_adjuntos.length > 0) || (t.anexosImagenes && t.anexosImagenes.length > 0)) && (
                                            <div className="space-y-1 pt-2 border-t">
                                                <p className="text-xs font-medium text-muted-foreground">Archivos:</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {t.archivos_adjuntos?.map((url, i) => (
                                                        <Button
                                                            key={i}
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-xs px-2"
                                                            onClick={() => window.open(url.startsWith('http') ? url : url, '_blank')}
                                                        >
                                                            <FileText className="h-3 w-3 mr-1" /> DXF {i > 0 ? i + 1 : ''}
                                                        </Button>
                                                    ))}
                                                    {t.anexosImagenes?.map((url, i) => (
                                                        <Button
                                                            key={`anexo-${i}`}
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-xs px-2"
                                                            onClick={() => window.open(url, '_blank')}
                                                        >
                                                            <FileText className="h-3 w-3 mr-1" /> IMG {i + 1}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Plan de corte local */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium">Plan de corte</h3>
                        <div className="space-y-2">
                            <div className="text-sm">Utilización local: {(planLocal.utilization * 100).toFixed(2)}%</div>
                            <div className="grid md:grid-cols-2 gap-2">
                                {planLocal.placements.map((p, idx) => (
                                    <div key={idx} className="flex items-center justify-between px-3 py-2 border rounded-md">
                                        <div className="text-sm">{p.pieza.largo}×{p.pieza.ancho} cm</div>
                                        <div className="text-xs text-muted-foreground">
                                            Posición: ({p.x}, {p.y}) {p.rotado ? '↻' : ''}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Medidas priorizadas */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium">Medidas priorizadas</h3>
                        <div className="grid md:grid-cols-3 gap-2">
                            {medidasPriorizadas.map((m, idx) => (
                                <div key={idx} className="flex items-center justify-between px-3 py-2 border rounded-md">
                                    <div className="text-sm">{m.largo}×{m.ancho} cm</div>
                                    <div className="text-xs text-muted-foreground">{m.count} u · {(m.area / 10000).toFixed(2)} m²</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Retazo generado automáticamente */}
                    <div className="space-y-2 border-t pt-4">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4 text-orange-600" /> Retazo Generado
                        </h3>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-orange-700 mb-1">Medidas del Retazo:</div>
                                    <div className="font-mono text-lg font-bold text-orange-800">
                                        {retazoAncho} × {retazoAlto} cm
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-orange-700 mb-1">Área del Retazo:</div>
                                    <div className="font-mono text-lg font-bold text-orange-800">
                                        {(areaRetazo / 10000).toFixed(3)} m²
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 text-xs text-orange-600">
                                Este retazo será creado automáticamente y asignado al inventario tras imprimir.
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 py-2 border-t">
                        <Button onClick={handleImprimirYCrearLote} className="bg-blue-600 hover:bg-blue-700">
                            Imprimir y Crear Lote {dialogData.key}
                        </Button>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
