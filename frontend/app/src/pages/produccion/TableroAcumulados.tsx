import React, { useEffect, useState } from 'react';
import { 
  Layers, 
  Clock, 
  Maximize2, 
  AlertCircle,
  TrendingUp,
  Box,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface Acumulado {
  id: string;
  material_nombre: string;
  espesor: number | null;
  estado: string;
  deadline: string;
  m2_actuales: number;
  capacidad_m2: number;
  trabajos_count: number;
  placa_reservada_id: string;
}

import { get } from '../../api';

export function TableroAcumulados() {
  const [acumulados, setAcumulados] = useState<Acumulado[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAcumulados = async () => {
    try {
      const data = await get<Acumulado[]>('/api/produccion/acumuladores');
      setAcumulados(data);
    } catch (error) {
      toast.error('Error al cargar tablero de acumulados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcumulados();
    // Refresh cada 5 minutos
    const interval = setInterval(fetchAcumulados, 300000);
    return () => clearInterval(interval);
  }, []);

  const getUrgencyColor = (deadline: string) => {
    const today = new Date();
    const dl = new Date(deadline);
    const diff = dl.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days <= 2) return 'text-red-600 bg-red-50 border-red-200';
    if (days <= 5) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Layers className="w-8 h-8 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tablero de Acumulados</h1>
        <p className="text-muted-foreground">Grupos automáticos por material. Se cierran al llenarse la placa o por deadline.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {acumulados.map((a) => {
          const percentage = Math.min(Math.round((a.m2_actuales / a.capacidad_m2) * 100), 100);
          
          return (
            <div key={a.id} className="bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
              <div className="p-5 border-b bg-muted/30">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Box className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-lg leading-tight">{a.material_nombre}</h3>
                  </div>
                  <span className="text-xs font-mono bg-background px-2 py-1 rounded border">
                    {a.espesor}mm
                  </span>
                </div>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getUrgencyColor(a.deadline)}`}>
                  <Clock className="w-3 h-3" />
                  CORTA: {a.deadline}
                </div>
              </div>

              <div className="p-5 flex-1 space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      Ocupación
                    </span>
                    <span>{percentage}%</span>
                  </div>
                  <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        percentage > 85 ? 'bg-red-500' : percentage > 50 ? 'bg-amber-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    <span>{(a.m2_actuales * 10000).toLocaleString()} cm² usados</span>
                    <span>{(a.capacidad_m2 * 10000).toLocaleString()} cm² totales</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/40 p-3 rounded-lg border text-center">
                    <div className="text-2xl font-bold">{a.trabajos_count}</div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase">Pedidos</div>
                  </div>
                  <div className="bg-muted/40 p-3 rounded-lg border text-center">
                    <div className="text-2xl font-bold">{((a.capacidad_m2 - a.m2_actuales) * 10000).toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase">cm² Libres</div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted/10 border-t mt-auto">
                <button 
                  className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  onClick={() => window.location.href = `/produccion/taller?acumulado=${a.id}`}
                >
                  Ver Detalles y Optimización
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {acumulados.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl bg-muted/20">
            <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium">No hay acumuladores abiertos</h3>
            <p className="text-muted-foreground">Los acumuladores se crean automáticamente cuando se aprueba un pedido de un nuevo material.</p>
          </div>
        )}
      </div>
    </div>
  );
}
