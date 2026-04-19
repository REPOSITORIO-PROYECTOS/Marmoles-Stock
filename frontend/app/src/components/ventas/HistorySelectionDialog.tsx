import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Clock, FileJson, Loader2 } from "lucide-react";
import { Input } from "../ui/input";
import { get } from '../../api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface HistorySelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (geometry: any, materialInfo?: any) => void;
}

export function HistorySelectionDialog({ open, onOpenChange, onSelect }: HistorySelectionDialogProps) {
  const [activeTab, setActiveTab] = useState('history');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data states
  const [historyItems, setHistoryItems] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      loadData(activeTab);
    }
  }, [open, activeTab]);

  const loadData = async (tab: string) => {
    setLoading(true);
    try {
      if (tab === 'history') {
        // Cargar últimos presupuestos
        const res = await get('/api/presupuestos');
        // Asumimos que res es una lista de presupuestos.
        // Necesitamos aplanar esto a líneas de presupuesto que tengan geometría
        const flatItems: any[] = [];
        
        if (Array.isArray(res)) {
          // Ordenar por fecha reciente (si tienen fecha, sino por orden de llegada que suele ser ID)
          // Asumimos que la API devuelve los más recientes primero o los ordenamos nosotros si hay campo fecha
          
          for (const pres of res) {
            if (pres.lineas && Array.isArray(pres.lineas)) {
              pres.lineas.forEach((linea: any, idx: number) => {
                if (linea.geometria_json) {
                  try {
                    const geo = JSON.parse(linea.geometria_json);
                    // Solo agregamos si tiene algo de contenido
                    if (geo.placements && geo.placements.length > 0 || (geo.primitives && geo.primitives.length > 0)) {
                      flatItems.push({
                        id: linea.id || `${pres.id}-${idx}`,
                        source: 'presupuesto',
                        title: `${linea.material} - ${pres.cliente_id ? 'Cliente #' + pres.cliente_id.slice(0,4) : 'Sin Cliente'}`,
                        subtitle: format(new Date(), "d 'de' MMMM", { locale: es }), // Idealmente usar fecha del presupuesto
                        detail: `${linea.metros_cuadrados.toFixed(2)} m²`,
                        geometry: geo,
                        material: linea.material,
                        originalPrice: linea.precio_unitario
                      });
                    }
                  } catch (e) {
                    // Ignore parsing errors
                  }
                }
              });
            }
          }
        }
        setHistoryItems(flatItems.slice(0, 50)); // Limit to 50
      }
    } catch (e) {
      console.error("Error loading data", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = historyItems.filter(item => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.subtitle.toLowerCase().includes(searchTerm.toLowerCase())
  );


  const handleSelect = (item: any) => {
    onSelect(item.geometry, {
        materialNombre: item.material, // Para referencia
        precioBase: item.originalPrice // Por si quieren usar el precio histórico (opcional)
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Cargar Diseño / Corte</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Historial Reciente
                </TabsTrigger>
              </TabsList>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                <Input 
                  placeholder="Buscar..." 
                  className="pl-8" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[300px] p-1">
              {loading ? (
                <div className="flex justify-center items-center h-full py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No se encontraron resultados
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredItems.map((item) => (
                    <Card 
                      key={item.id} 
                      className="cursor-pointer hover:border-cyan-500 transition-colors group"
                      onClick={() => handleSelect(item)}
                    >
                      <CardContent className="p-4 flex gap-4">
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center shrink-0">
                          {item.img ? (
                            <img src={item.img} alt="" className="w-full h-full object-cover rounded" />
                          ) : (
                            item.source === 'history' ? <Clock className="w-6 h-6 text-gray-400" /> : <FileJson className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate group-hover:text-cyan-600">{item.title}</h4>
                          <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs bg-gray-50 w-fit px-2 py-1 rounded">
                             {item.detail}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
