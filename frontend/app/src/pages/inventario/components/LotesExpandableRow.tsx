import React, { useState } from 'react';
import { Badge, Info, Package, Edit2, Check, X, Printer } from 'lucide-react';
import { Lote, Material } from '../types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { patch } from '../../../api';
import { notifySuccess, notifyError } from '../../../utils/notifications';

interface LotesExpandableRowProps {
    material: Material;
    lotes: Lote[];
    loading: boolean;
    onEliminarLote?: (material: Material, loteId: string) => void;
    onActualizarLote?: () => void;
}

export const LotesExpandableRow: React.FC<LotesExpandableRowProps> = ({
    material,
    lotes,
    loading,
    onEliminarLote,
    onActualizarLote,
}) => {
    const [editingLoteId, setEditingLoteId] = useState<string | null>(null);
    const [editingUbicacion, setEditingUbicacion] = useState('');
    const [editingCosto, setEditingCosto] = useState(0);
    const [editingCantidad, setEditingCantidad] = useState(0);
    const [editingPrecioVenta, setEditingPrecioVenta] = useState(0);
    const [editingPrecioMayorista, setEditingPrecioMayorista] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    const iniciarEdicion = (lote: Lote) => {
        setEditingLoteId(lote.id);
        setEditingUbicacion(lote.ubicacion || '');
        setEditingCosto(lote.costo_m2 || 0);
        setEditingCantidad(lote.cantidad || 1);
        setEditingPrecioVenta((lote as any).precio_venta || 0);
        setEditingPrecioMayorista((lote as any).precio_mayorista || 0);
    };

    const cancelarEdicion = () => {
        setEditingLoteId(null);
        setEditingUbicacion('');
        setEditingCosto(0);
        setEditingCantidad(0);
        setEditingPrecioVenta(0);
        setEditingPrecioMayorista(0);
    };

    const guardarEdicion = async (loteId: string) => {
        setIsSaving(true);
        try {
            await patch(`/api/lotes/${loteId}`, {
                ubicacion: editingUbicacion || null,
                costo_m2: editingCosto,
                cantidad: editingCantidad,
                precio_venta: editingPrecioVenta,
                precio_mayorista: editingPrecioMayorista
            });
            notifySuccess('Lote actualizado correctamente');
            cancelarEdicion();
            onActualizarLote?.();
        } catch (err: any) {
            notifyError(err?.message || 'Error al actualizar lote');
        } finally {
            setIsSaving(false);
        }
    };

    const imprimirTicketLote = (l: Lote) => {
        const largoCm = l.largo_m ? (l.largo_m * 100).toFixed(0) : 'N/A';
        const anchoCm = l.ancho_m ? (l.ancho_m * 100).toFixed(0) : 'N/A';
        const superficie = (l.stock_actual || 0).toLocaleString();
        const costo = l.costo_m2 ? `$${l.costo_m2.toLocaleString()}` : 'N/A';
        const precioMenor = material.precioM2 != null ? `$${material.precioM2.toLocaleString()}` : 'N/A';
        const precioMayor = material.precioMayorM2 != null ? `$${material.precioMayorM2.toLocaleString()}` : (material.precioM2 != null ? `$${material.precioM2.toLocaleString()}` : 'N/A');
        const fecha = l.fecha_ingreso
            ? new Date(l.fecha_ingreso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'N/A';
        const html = `
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8">
            <title>Ticket Lote</title>
            <style>
              body { font-family: Arial, sans-serif; color: #333; margin: 20px; }
              .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
              .title { font-size: 18px; font-weight: 800; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
              .item { background: #f7f7f7; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
              .label { font-size: 11px; color: #666; }
              .value { font-size: 14px; font-weight: 700; }
              .footer { margin-top: 16px; text-align: center; font-size: 12px; color: #555; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">Ticket de Lote</div>
              <div>${new Date().toLocaleString()}</div>
            </div>
            <div class="grid">
              <div class="item"><div class="label">Código</div><div class="value">${l.codigo_lote || 'SIN_LOTE'}</div></div>
              <div class="item"><div class="label">Fecha Ingreso</div><div class="value">${fecha}</div></div>
              <div class="item"><div class="label">Largo y Ancho</div><div class="value">${largoCm} × ${anchoCm} cm</div></div>
              <div class="item"><div class="label">Cantidad</div><div class="value">${l.cantidad || 1}</div></div>
              <div class="item"><div class="label">Superficie</div><div class="value">${superficie} m²</div></div>
              <div class="item"><div class="label">Costo m²</div><div class="value">${costo}</div></div>
              <div class="item"><div class="label">Precio por menor m²</div><div class="value">${precioMenor}</div></div>
              <div class="item"><div class="label">Precio por mayor m²</div><div class="value">${precioMayor}</div></div>
              <div class="item"><div class="label">Ubicación</div><div class="value">${l.ubicacion || 'Sin ubicación'}</div></div>
              <div class="item"><div class="label">Proveedor</div><div class="value">${l.proveedor_nombre || 'No especificado'}</div></div>
            </div>
            ${l.notas ? `<div class="footer">Notas: ${l.notas}</div>` : `<div class="footer">Inventario de Lotes</div>`}
            <script>window.onload = function(){ window.print(); }</script>
          </body>
          </html>
        `;
        const w = window.open('', '_blank', 'width=420,height=600');
        if (w) {
            w.document.open();
            w.document.write(html);
            w.document.close();
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 px-4">
                <div className="h-4 w-4 animate-spin border-2 border-primary border-t-transparent rounded-full" />
                Cargando lotes…
            </div>
        );
    }

    if (lotes.length === 0) {
        return (
            <div className="p-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-muted/50 border border-dashed border-muted-foreground/20 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-full">
                            <Info className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="font-medium text-foreground">Sin registros de compra</p>
                            <p className="text-sm text-muted-foreground">
                                No se han registrado lotes para <span className="font-semibold">{material.nombre}</span>.
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const event = new CustomEvent('marmoles:navigate', {
                                detail: { target: 'compras', material: material.nombre }
                            });
                            window.dispatchEvent(event);
                        }}
                    >
                        Registrar Primera Compra
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            {/* Barra de resumen */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl mb-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-xl shadow-inner">
                        <Package className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-foreground tracking-tight">{material.nombre}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs bg-secondary px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                                {lotes.length} {lotes.length !== 1 ? 'Lotes' : 'Lote'}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                                Historial de adquisiciones
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-stretch gap-0 bg-background/50 backdrop-blur-sm rounded-lg border shadow-sm overflow-hidden">
                    <div className="px-4 py-2 flex flex-col justify-center min-w-[100px]">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Stock Actual</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-primary">{material.stockActual}</span>
                            <span className="text-[10px] font-medium text-muted-foreground">{material.unidad}</span>
                        </div>
                    </div>

                    <div className="w-[1px] bg-border my-2"></div>

                    <div className="px-4 py-2 flex flex-col justify-center min-w-[120px]">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Último Ingreso</span>
                        <div className="text-sm font-bold text-foreground">
                            {(() => {
                                const lotesSorted = [...lotes].sort((a, b) =>
                                    (b.fecha_ingreso || '').localeCompare(a.fecha_ingreso || '')
                                );
                                const lastDate = lotesSorted[0]?.fecha_ingreso;
                                if (lastDate) {
                                    const d = new Date(lastDate);
                                    return !isNaN(d.getTime())
                                        ? d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                        : 'N/A';
                                }
                                return 'N/A';
                            })()}
                        </div>
                    </div>

                    <div className="w-[1px] bg-border my-2"></div>

                    <div className="px-4 py-2 flex flex-col justify-center min-w-[100px] bg-primary/5">
                        <span className="text-[10px] text-primary/70 uppercase font-bold tracking-tighter">Último Lote</span>
                        <div className="text-sm font-black text-primary truncate max-w-[80px]">
                            {(() => {
                                const lotesSorted = [...lotes].sort((a, b) =>
                                    (b.fecha_ingreso || '').localeCompare(a.fecha_ingreso || '')
                                );
                                return lotesSorted[0]?.codigo_lote || 'S/L';
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de lotes */}
            <div className="grid grid-cols-1 gap-3">
                {lotes.map((l) => (
                    <div
                        key={l.id}
                        className="group relative border rounded-lg p-4 bg-background hover:border-primary/50 hover:shadow-md transition-all duration-200 overflow-hidden"
                    >
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors"></div>

                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        Código Identificador
                                    </span>
                                    <span className="text-base font-black tracking-tight text-foreground">
                                        {l.codigo_lote || 'SIN_LOTE'}
                                    </span>
                                </div>
                                {l.cantidad > 1 && (
                                    <span className="bg-primary/5 text-primary border border-primary/20 font-bold px-2 py-1 rounded text-xs">
                                        {l.cantidad} UNIDADES
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    Fecha Ingreso
                                </span>
                                <span className="text-sm font-semibold">
                                    {l.fecha_ingreso
                                        ? new Date(l.fecha_ingreso).toLocaleDateString('es-AR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                        })
                                        : 'N/A'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-muted/30 p-3 rounded-lg border border-muted-foreground/10">
                            <div className="space-y-0.5">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                                    Largo y Ancho (cm)
                                </span>
                                <div className="text-sm font-bold flex items-center gap-1">
                                    {l.largo_m && l.ancho_m ? (
                                        <>
                                            <span className="text-xs text-muted-foreground">L:</span>
                                            <span>{(l.largo_m * 100).toFixed(0)}</span>
                                            <span className="text-muted-foreground text-[10px]">×</span>
                                            <span className="text-xs text-muted-foreground">A:</span>
                                            <span>{(l.ancho_m * 100).toFixed(0)}</span>
                                        </>
                                    ) : (
                                        'N/A'
                                    )}
                                </div>
                            </div>

                            <div className="space-y-0.5 border-l border-muted-foreground/20 pl-4">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                                    Cantidad (Unidades)
                                </span>
                                {editingLoteId === l.id ? (
                                    <Input
                                        type="number"
                                        step="1"
                                        min="1"
                                        value={editingCantidad}
                                        onChange={(e) => setEditingCantidad(parseInt(e.target.value) || 1)}
                                        className="text-sm h-8"
                                    />
                                ) : (
                                    <div className="text-sm font-bold">
                                        {l.cantidad || 1}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-0.5 border-l border-muted-foreground/20 pl-4">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                                    Superficie
                                </span>
                                <div className="text-sm font-bold text-primary">
                                    {l.stock_actual.toLocaleString()}{' '}
                                    <span className="text-[10px] font-medium">m²</span>
                                </div>
                            </div>

                            <div className="space-y-0.5 border-l border-muted-foreground/20 pl-4">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                                    Costo Unitario
                                </span>
                                {editingLoteId === l.id ? (
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editingCosto}
                                        onChange={(e) => setEditingCosto(parseFloat(e.target.value) || 0)}
                                        className="text-sm h-8"
                                    />
                                ) : (
                                    <div className="text-sm font-bold text-black">
                                        {l.costo_m2 ? `$${l.costo_m2.toLocaleString()}` : 'N/A'}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-0.5 border-l border-muted-foreground/20 pl-4">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                                    Precio por menor m²
                                </span>
                                <div className="text-sm font-bold text-black">
                                    {material.precioM2 != null ? `$${material.precioM2.toLocaleString()}` : 'N/A'}
                                </div>
                            </div>

                            <div className="space-y-0.5 border-l border-muted-foreground/20 pl-4">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                                    Precio por mayor m²
                                </span>
                                <div className="text-sm font-bold text-black">
                                    {material.precioMayorM2 != null ? `$${material.precioMayorM2.toLocaleString()}` : (material.precioM2 != null ? `$${material.precioM2.toLocaleString()}` : 'N/A')}
                                </div>
                            </div>

                            <div className="space-y-0.5 border-l border-muted-foreground/20 pl-4">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                                    Ubicación
                                </span>
                                {editingLoteId === l.id ? (
                                    <Input
                                        type="text"
                                        value={editingUbicacion}
                                        onChange={(e) => setEditingUbicacion(e.target.value)}
                                        placeholder="Ej: Galpón A"
                                        className="text-sm h-8"
                                    />
                                ) : (
                                    <div className="text-sm font-bold text-muted-foreground">
                                        {l.ubicacion || 'Sin ubicación'}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-0.5 border-l border-muted-foreground/20 pl-4">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                                    Proveedor
                                </span>
                                <div className="text-sm font-bold truncate text-muted-foreground group-hover:text-foreground transition-colors">
                                    {l.proveedor_nombre || 'No especificado'}
                                </div>
                            </div>
                        </div>

                        {l.notas && (
                            <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-background/50 p-2 rounded border border-dashed">
                                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                <span className="italic leading-tight">"{l.notas}"</span>
                            </div>
                        )}

                        <div className="mt-4 flex justify-end gap-2">
                            {editingLoteId === l.id ? (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={cancelarEdicion}
                                        disabled={isSaving}
                                        title="Cancelar edición"
                                    >
                                        <X className="h-4 w-4 mr-1" />
                                        Cancelar
                                    </Button>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => guardarEdicion(l.id)}
                                        disabled={isSaving}
                                        title="Guardar cambios"
                                    >
                                        <Check className="h-4 w-4 mr-1" />
                                        {isSaving ? 'Guardando...' : 'Guardar'}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => iniciarEdicion(l)}
                                        title="Editar ubicación y costo"
                                    >
                                        <Edit2 className="h-4 w-4 mr-1" />
                                        Editar
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => imprimirTicketLote(l)}
                                        title="Imprimir ticket de lote"
                                    >
                                        <Printer className="h-4 w-4 mr-1" />
                                        Ticket
                                    </Button>
                                    {onEliminarLote && (
                                        <Button
                                            variant="ghost"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            size="sm"
                                            onClick={() => onEliminarLote(material, l.id)}
                                            title="Eliminar lote"
                                        >
                                            Eliminar
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
