import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { AlertCircle, CheckCircle2, Package, Layers, ArrowRight } from 'lucide-react';
import { get } from '../../api';
import { toast } from 'sonner';

interface Retazo {
  id: string;
  material_id: string;
  lote_id: string | null;
  ancho: number;
  largo: number;
  espesor: number | null;
  ubicacion: string | null;
}

interface RecomendacionStockProps {
  materialId: string;
  placements: Array<{ w: number; h: number }>;
  loteSeleccionado: string;
  onSeleccionarRetazo?: (retazoId: string) => void;
  onUsarLote?: () => void;
}

export function RecomendacionStock({
  materialId,
  placements,
  loteSeleccionado,
  onSeleccionarRetazo,
  onUsarLote
}: RecomendacionStockProps) {
  const [recomendacion, setRecomendacion] = useState<{
    tipo: 'retazo' | 'lote' | null;
    retazos: Retazo[];
    mensaje: string;
  }>({
    tipo: null,
    retazos: [],
    mensaje: ''
  });
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!materialId || materialId === '__manual__' || materialId.startsWith('prod:')) {
      setRecomendacion({ tipo: null, retazos: [], mensaje: '' });
      return;
    }

    if (!placements || placements.length === 0) {
      setRecomendacion({ tipo: null, retazos: [], mensaje: '' });
      return;
    }

    // Obtener las medidas máximas de todas las piezas
    const obtenerSugerencias = async () => {
      setCargando(true);
      try {
        // Encontrar la pieza más grande para buscar retazos
        let maxW = 0;
        let maxH = 0;
        for (const p of placements) {
          const w = Math.ceil(p.w || 0);
          const h = Math.ceil(p.h || 0);
          maxW = Math.max(maxW, w, h); // Considerar ambas orientaciones
          maxH = Math.max(maxH, w, h);
        }

        if (maxW === 0 || maxH === 0) {
          setRecomendacion({ tipo: null, retazos: [], mensaje: '' });
          setCargando(false);
          return;
        }

        // Llamar al endpoint de sugerencias de retazos
        const retazos = await get<Retazo[]>(
          `/api/inventario/retazos/sugerencias?material_id=${materialId}&w=${maxW}&h=${maxH}`
        );

        if (retazos && retazos.length > 0) {
          // Hay retazos disponibles!
          const retazoOptimo = retazos[0]; // El más pequeño que cabe
          const areaRetazo = (retazoOptimo.ancho * retazoOptimo.largo) / 10000;
          const areaNecesaria = placements.reduce((sum, p) => sum + ((p.w * p.h) / 10000), 0);
          
          const mensaje = `✅ Se encontraron ${retazos.length} retazo(s) disponible(s) para estas medidas. 
          El retazo óptimo es de ${retazoOptimo.largo}×${retazoOptimo.ancho} cm (${areaRetazo.toFixed(2)} m²).
          Área necesaria: ${areaNecesaria.toFixed(2)} m². 
          ${retazoOptimo.ubicacion ? `Ubicación: ${retazoOptimo.ubicacion}` : ''}`;

          setRecomendacion({
            tipo: 'retazo',
            retazos: retazos,
            mensaje
          });
        } else {
          // No hay retazos, recomendar lote completo
          setRecomendacion({
            tipo: 'lote',
            retazos: [],
            mensaje: `ℹ️ No se encontraron retazos disponibles para estas medidas (${maxH}×${maxW} cm). Se recomienda usar un lote completo.`
          });
        }
      } catch (error) {
        console.error('Error obteniendo sugerencias:', error);
        setRecomendacion({
          tipo: 'lote',
          retazos: [],
          mensaje: 'No se pudieron cargar las sugerencias. Se recomienda usar un lote completo.'
        });
      } finally {
        setCargando(false);
      }
    };

    // Debounce para no hacer muchas llamadas
    const timer = setTimeout(() => {
      obtenerSugerencias();
    }, 500);

    return () => clearTimeout(timer);
  }, [materialId, placements]);

  if (!recomendacion.tipo || cargando) {
    return null;
  }

  return (
    <Card className={`border-2 ${recomendacion.tipo === 'retazo' ? 'border-emerald-500 bg-emerald-50' : 'border-blue-500 bg-blue-50'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${recomendacion.tipo === 'retazo' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
            {recomendacion.tipo === 'retazo' ? (
              <Package className="h-5 w-5 text-emerald-600" />
            ) : (
              <Layers className="h-5 w-5 text-blue-600" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className={`text-sm font-bold uppercase tracking-tight ${recomendacion.tipo === 'retazo' ? 'text-emerald-700' : 'text-blue-700'}`}>
                {recomendacion.tipo === 'retazo' ? '🎯 Retazo Disponible' : '📦 Usar Lote Completo'}
              </h4>
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-line mb-3">
              {recomendacion.mensaje}
            </p>

            {recomendacion.tipo === 'retazo' && recomendacion.retazos.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-emerald-700">
                  Retazos recomendados ({recomendacion.retazos.length}):
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {recomendacion.retazos.slice(0, 3).map((retazo) => (
                    <Button
                      key={retazo.id}
                      variant={loteSeleccionado === retazo.id ? 'default' : 'outline'}
                      size="sm"
                      className="w-full justify-between text-xs h-auto py-2"
                      onClick={() => {
                        if (onSeleccionarRetazo) {
                          onSeleccionarRetazo(retazo.id);
                          toast.success(`Retazo seleccionado: ${retazo.largo}×${retazo.ancho} cm`);
                        }
                      }}
                    >
                      <span className="flex items-center gap-2">
                        {loteSeleccionado === retazo.id && <CheckCircle2 className="h-3 w-3" />}
                        <span className="font-mono">{retazo.largo} × {retazo.ancho} cm</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {((retazo.ancho * retazo.largo) / 10000).toFixed(2)} m²
                      </span>
                    </Button>
                  ))}
                </div>
                {recomendacion.retazos.length > 3 && (
                  <div className="text-[10px] text-muted-foreground italic text-center">
                    + {recomendacion.retazos.length - 3} retazos más disponibles
                  </div>
                )}
              </div>
            )}

            {recomendacion.tipo === 'lote' && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  if (onUsarLote) {
                    onUsarLote();
                  }
                }}
              >
                <Layers className="h-3 w-3 mr-2" />
                Continuar con Lote Completo
                <ArrowRight className="h-3 w-3 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
