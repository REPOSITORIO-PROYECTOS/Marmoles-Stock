import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
    Printer,
    AlertTriangle,
    CheckCircle2,
    Maximize2,
    Package,
    TrendingUp,
    X
} from 'lucide-react';
import { toast } from 'sonner';

interface PiezaSeleccionada {
    id: string;
    trabajoId: string;
    cliente: string;
    w: number;
    h: number;
    qty: number;
    material: string;
    idx: number;
}

interface PlanCortePreviewProps {
    piezasSeleccionadas: PiezaSeleccionada[];
    planchaAncho?: number;
    planchaAlto?: number;
    onRemovePieza: (id: string) => void;
    onGenerarPlan: () => void;
    onLimpiarSeleccion: () => void;
}

export function PlanCortePreview({
    piezasSeleccionadas,
    planchaAncho = 300,
    planchaAlto = 180,
    onRemovePieza,
    onGenerarPlan,
    onLimpiarSeleccion
}: PlanCortePreviewProps) {
    const [validacion, setValidacion] = useState<{
        caben: boolean;
        areaTotal: number;
        areaPlancha: number;
        aprovechamiento: number;
        piezasGrandes: PiezaSeleccionada[];
    } | null>(null);

    useEffect(() => {
        if (piezasSeleccionadas.length === 0) {
            setValidacion(null);
            return;
        }

        const areaPlancha = (planchaAncho * planchaAlto) / 10000; // m²
        let areaTotal = 0;
        const piezasGrandes: PiezaSeleccionada[] = [];

        piezasSeleccionadas.forEach(p => {
            const areaPieza = (p.w * p.h * p.qty) / 10000;
            areaTotal += areaPieza;

            // Validar si la pieza individual cabe en la plancha
            if (p.w > planchaAncho || p.h > planchaAlto) {
                // Probar rotada
                if (p.h > planchaAncho || p.w > planchaAlto) {
                    piezasGrandes.push(p);
                }
            }
        });

        const aprovechamiento = (areaTotal / areaPlancha) * 100;
        const caben = areaTotal <= areaPlancha && piezasGrandes.length === 0;

        setValidacion({
            caben,
            areaTotal,
            areaPlancha,
            aprovechamiento,
            piezasGrandes
        });
    }, [piezasSeleccionadas, planchaAncho, planchaAlto]);

    if (piezasSeleccionadas.length === 0) {
        return (
            <Card className="border-2 border-dashed border-gray-300">
                <CardContent className="py-12 text-center">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">
                        No hay piezas seleccionadas
                    </h3>
                    <p className="text-sm text-gray-500">
                        Selecciona piezas de la lista para generar un plan de corte
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-2 border-cyan-500 shadow-lg">
            <CardHeader className="bg-cyan-50 border-b-2 border-cyan-200">
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-cyan-600" />
                        Plan de Corte
                        <Badge className="bg-cyan-600 text-white ml-2">
                            {piezasSeleccionadas.length} pieza{piezasSeleccionadas.length !== 1 ? 's' : ''}
                        </Badge>
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onLimpiarSeleccion}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                        <X className="h-4 w-4 mr-1" />
                        Limpiar
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
                {/* Validación visual */}
                {validacion && (
                    <div className={`p-4 rounded-lg border-2 ${validacion.caben
                            ? 'bg-green-50 border-green-300'
                            : 'bg-red-50 border-red-300'
                        }`}>
                        <div className="flex items-start gap-3">
                            {validacion.caben ? (
                                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                                <h4 className={`font-bold text-lg mb-2 ${validacion.caben ? 'text-green-900' : 'text-red-900'
                                    }`}>
                                    {validacion.caben
                                        ? '✓ Las piezas caben en la plancha'
                                        : '✗ Hay problemas con el plan'}
                                </h4>

                                {validacion.piezasGrandes.length > 0 && (
                                    <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded">
                                        <p className="text-sm font-bold text-red-900 mb-2">
                                            ⚠️ {validacion.piezasGrandes.length} pieza(s) muy grande(s):
                                        </p>
                                        {validacion.piezasGrandes.map((p, i) => (
                                            <div key={i} className="text-xs text-red-800 font-mono">
                                                • P{p.idx + 1}: {p.h}×{p.w}cm (máx: {planchaAlto}×{planchaAncho}cm) - {p.cliente}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-4 mt-3">
                                    <div className="text-center p-3 bg-white rounded-lg border">
                                        <div className="text-xs text-gray-600 font-medium">Área Total</div>
                                        <div className="text-xl font-black text-gray-900">
                                            {validacion.areaTotal.toFixed(2)} m²
                                        </div>
                                    </div>
                                    <div className="text-center p-3 bg-white rounded-lg border">
                                        <div className="text-xs text-gray-600 font-medium">Plancha</div>
                                        <div className="text-xl font-black text-gray-900">
                                            {validacion.areaPlancha.toFixed(2)} m²
                                        </div>
                                    </div>
                                    <div className="text-center p-3 bg-white rounded-lg border">
                                        <div className="text-xs text-gray-600 font-medium">Uso</div>
                                        <div className={`text-xl font-black ${validacion.aprovechamiento > 85
                                                ? 'text-red-600'
                                                : validacion.aprovechamiento > 70
                                                    ? 'text-amber-600'
                                                    : 'text-green-600'
                                            }`}>
                                            {validacion.aprovechamiento.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Lista de piezas seleccionadas */}
                <div className="space-y-2">
                    <h4 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Piezas en este plan:
                    </h4>
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                        {piezasSeleccionadas.map((pieza, idx) => (
                            <div
                                key={`${pieza.trabajoId}-${pieza.idx}`}
                                className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-md transition-all"
                            >
                                <div className="flex-shrink-0">
                                    <Badge variant="outline" className="font-mono">
                                        {idx + 1}
                                    </Badge>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate">{pieza.cliente}</div>
                                    <div className="text-xs text-gray-600">
                                        <span className="font-mono font-bold">{pieza.h}×{pieza.w}cm</span>
                                        {pieza.qty > 1 && <span className="ml-2">× {pieza.qty}</span>}
                                        <span className="ml-2 text-gray-400">
                                            ({((pieza.w * pieza.h * pieza.qty) / 10000).toFixed(3)}m²)
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onRemovePieza(`${pieza.trabajoId}-${pieza.idx}`)}
                                    className="flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Botones de acción */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => window.open(`https://www.google.com/maps?q=${planchaAncho},${planchaAlto}`, '_blank')}
                        className="w-full"
                    >
                        <Maximize2 className="h-4 w-4 mr-2" />
                        Ver Dimensiones
                    </Button>
                    <Button
                        size="lg"
                        onClick={onGenerarPlan}
                        disabled={!validacion?.caben}
                        className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold"
                    >
                        <Printer className="h-4 w-4 mr-2" />
                        Generar Plan
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
