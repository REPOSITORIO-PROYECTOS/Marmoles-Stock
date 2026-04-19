import { useState } from 'react';
import { Checkbox } from '../ui/checkbox';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Trash2, MapPin, Ruler, CheckCircle2, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface Pieza {
    id?: string;
    w?: number;
    h?: number;
    ancho?: number;
    largo?: number;
    qty?: number;
    cantidad?: number;
    ubicacion?: string;
    estado?: string;
    nombre?: string;
}

interface PiezaCardProps {
    pieza: Pieza;
    idx: number;
    trabajoId: string;
    clienteNombre: string;
    material: string;
    isSelected: boolean;
    isCortada: boolean;
    onToggleSelect: () => void;
    onEliminar?: () => void;
    onAsignarUbicacion?: () => void;
    onMarcarCortada?: () => void;
    onImprimirEtiqueta?: () => void;
    precioM2?: number;
}

export function PiezaCard({
    pieza,
    idx,
    trabajoId,
    clienteNombre,
    material,
    isSelected,
    isCortada,
    onToggleSelect,
    onEliminar,
    onAsignarUbicacion,
    onMarcarCortada,
    onImprimirEtiqueta,
    precioM2 = 15000
}: PiezaCardProps) {
    const ancho = pieza.w || pieza.ancho || 0;
    const largo = pieza.h || pieza.largo || 0;
    const cantidad = pieza.qty || pieza.cantidad || 1;
    const areaM2 = (ancho * largo) / 10000;
    const precioTotal = areaM2 * precioM2 * cantidad;

    return (
        <div
            className={`group relative border rounded-lg p-4 transition-all hover:shadow-md ${isSelected
                    ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-200'
                    : isCortada
                        ? 'border-green-500 bg-green-50/50 opacity-60'
                        : 'border-gray-200 bg-white hover:border-cyan-300'
                }`}
        >
            {/* Checkbox de selección - Grande y visible */}
            <div className="absolute -top-2 -left-2 z-10">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={onToggleSelect}
                    disabled={isCortada}
                    className="h-6 w-6 border-2 bg-white shadow-md"
                />
            </div>

            {/* Estado cortada */}
            {isCortada && (
                <div className="absolute -top-2 -right-2">
                    <Badge className="bg-green-600 text-white shadow-md">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Cortada
                    </Badge>
                </div>
            )}

            <div className="space-y-3 ml-4">
                {/* Header con número de pieza */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-sm">
                            P{idx + 1}
                        </Badge>
                        {pieza.nombre && (
                            <span className="text-sm font-semibold text-gray-700">{pieza.nombre}</span>
                        )}
                    </div>
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onImprimirEtiqueta}
                            className="h-7 w-7 p-0"
                            title="Imprimir etiqueta"
                        >
                            <Tag className="h-3.5 w-3.5" />
                        </Button>
                        {onEliminar && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onEliminar}
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Eliminar pieza"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Medidas principales - Destacadas */}
                <div className="bg-gradient-to-r from-cyan-50 to-purple-50 rounded-lg p-3 border border-cyan-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Ruler className="h-4 w-4 text-cyan-600" />
                            <span className="text-2xl font-black text-cyan-900">
                                {largo} × {ancho}
                            </span>
                            <span className="text-sm text-gray-600">cm</span>
                        </div>
                        {cantidad > 1 && (
                            <Badge className="bg-purple-600 text-white text-sm">
                                {cantidad}x
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Información adicional */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded p-2">
                        <div className="text-gray-500 font-medium">Área unitaria</div>
                        <div className="font-bold text-gray-900">{areaM2.toFixed(3)} m²</div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                        <div className="text-gray-500 font-medium">Área total</div>
                        <div className="font-bold text-gray-900">{(areaM2 * cantidad).toFixed(3)} m²</div>
                    </div>
                    <div className="bg-cyan-50 rounded p-2 col-span-2">
                        <div className="text-cyan-600 font-medium">Precio estimado</div>
                        <div className="font-black text-cyan-900 text-lg">
                            ${Math.round(precioTotal).toLocaleString('es-AR')}
                        </div>
                    </div>
                </div>

                {/* Ubicación */}
                {pieza.ubicacion && (
                    <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded p-2">
                        <MapPin className="h-3 w-3 text-amber-600" />
                        <span className="font-medium text-amber-900">{pieza.ubicacion}</span>
                    </div>
                )}

                {/* Acciones */}
                {!isCortada && (
                    <div className="flex gap-2 pt-2 border-t">
                        {onAsignarUbicacion && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onAsignarUbicacion}
                                className="flex-1 text-xs"
                            >
                                <MapPin className="h-3 w-3 mr-1" />
                                Ubicación
                            </Button>
                        )}
                        {onMarcarCortada && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onMarcarCortada}
                                className="flex-1 text-xs border-green-300 text-green-700 hover:bg-green-50"
                            >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Marcar OK
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Indicador de selección */}
            {isSelected && (
                <div className="absolute inset-0 border-2 border-cyan-500 rounded-lg pointer-events-none">
                    <div className="absolute top-2 right-2 bg-cyan-500 text-white text-xs font-bold px-2 py-1 rounded">
                        SELECCIONADA
                    </div>
                </div>
            )}
        </div>
    );
}
