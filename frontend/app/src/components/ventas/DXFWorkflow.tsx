import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { FileDown, FileUp, Loader2, CheckCircle2, AlertCircle, Ruler, Zap, ImageIcon, Plus, Trash2 } from "lucide-react";
import { toast } from 'sonner';
import { post, get } from '../../api';
import { ImageWithFallback } from '../ui/ImageWithFallback';

interface DXFWorkflowProps {
  idProyecto: string;
  ancho: number;
  alto: number;
  onUpdatePlan: (placements: any[], areaM2: number, features: any[], primitives?: any[]) => void;
  onUpdateBoardDimensions?: (width: number, height: number) => void;
  initialPieces?: any[];
  materialId?: string;
  largoM?: number;
  anchoM?: number;
}

interface DXFResult {
  metros_lineales: number;
  area_m2: number;
  error?: string;
  warning?: string;
  dxf_url?: string;
  img_url?: string;
  status?: string;
  piezas?: any[];
}

export function DXFWorkflow({ idProyecto, ancho, alto, onUpdatePlan, onUpdateBoardDimensions, initialPieces, materialId, largoM, anchoM }: DXFWorkflowProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<DXFResult | null>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualWidth, setManualWidth] = useState("");
  const [manualHeight, setManualHeight] = useState("");
  const [manualQty, setManualQty] = useState<string>("1");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [boardDims, setBoardDims] = useState({ w: ancho, h: alto });
  const [placaCompleta, setPlacaCompleta] = useState<'completa' | 'recortes'>('recortes');
  const [planosManualCargados, setPlanosManualCargados] = useState<Array<{ id: string; nombre: string; resultado: DXFResult; archivo: File }>>([]);

  const handleTipoCorteChange = async (v: string) => {
    setPlacaCompleta(v as 'completa' | 'recortes');
    if (!materialId) {
      return;
    }
    const wCm = Math.round((anchoM || 0) * 100);
    const hCm = Math.round((largoM || 0) * 100);
    if (wCm <= 0 || hCm <= 0) {
      return;
    }
    try {
      if (v === 'recortes') {
        const retazos = await get<any[]>(`/api/inventario/retazos/sugerencias?material_id=${materialId}&w=${wCm}&h=${hCm}`);
        if (retazos && retazos.length > 0) {
          toast.success('Hay retazo disponible');
          return;
        }
      }
      const stock = await get<any[]>(`/api/inventario/stock-detallado?material_id=${materialId}`);
      const planchas = (stock || []).filter((s) => s.tipo === 'plancha' || s.tipo === 'lote');
      const hayPlancha = planchas.some((p) => {
        const w = Number(p.ancho || 0);
        const h = Number(p.largo || 0);
        return (w >= wCm && h >= hCm) || (w >= hCm && h >= wCm);
      });
      if (hayPlancha) {
        if (v === 'recortes') {
          toast.success('No hay retazo disponible, hay plancha disponible');
        } else {
          toast.success('Hay plancha disponible');
        }
      } else {
        toast.error('No hay retazo ni plancha disponible, cambiá de material');
      }
    } catch { }
  };

  // Inicializar manualPieces desde initialPieces si existen
  const [manualPieces, setManualPieces] = useState<any[]>(() => {
    if (initialPieces && initialPieces.length > 0) {
      return initialPieces.map(p => ({
        w: p.w || p.w_cm,
        h: p.h || p.h_cm,
        qty: p.qty || 1
      }));
    }
    return [];
  });

  React.useEffect(() => {
    setBoardDims({ w: ancho, h: alto });
  }, [ancho, alto]);

  // Efecto para procesar piezas iniciales al montar si existen
  React.useEffect(() => {
    if (manualPieces.length > 0) {
      recalculatePlacements(null, {}, manualPieces);
    }
  }, []); // Solo al montar

  // Si hay placements existentes al cargar, intentar recuperarlos (solo si vienen de manual)
  // Nota: Esto es complejo porque onUpdatePlan es callback, no prop de entrada completa.
  // Pero podríamos asumir que si se abre el modal, empezamos de 0 o acumulamos.
  // Por ahora, acumulamos en memoria local del componente.

  const recalculatePlacements = (currentResult: DXFResult | null, currentQuantities: Record<number, number>, currentManualPieces: any[]) => {
    let placements: any[] = [];
    let totalArea = 0;
    let totalLineales = 0;
    let allPieces = [];
    let itemsToPlace: any[] = [];

    // 1. Recolectar piezas del DXF
    if (currentResult && currentResult.piezas) {
      currentResult.piezas.forEach((p, idx) => {
        const qty = currentQuantities[idx] !== undefined ? currentQuantities[idx] : 1;
        if (qty > 0 && p.w_cm > 0 && p.h_cm > 0) {
          totalArea += (p.w_cm * p.h_cm * qty) / 10000;
          totalLineales += ((p.w_cm * 2 + p.h_cm * 2) * qty) / 100;
          allPieces.push(p);

          // Desglosar cantidad para nesting individual
          for (let i = 0; i < qty; i++) {
            itemsToPlace.push({
              w: p.w_cm,
              h: p.h_cm,
              src: 'dxf'
            });
          }
        }
      });
    }

    // 2. Recolectar piezas manuales
    currentManualPieces.forEach((p) => {
      const qty = p.qty || 1;
      totalArea += (p.w * p.h * qty) / 10000;
      totalLineales += ((p.w * 2 + p.h * 2) * qty) / 100;

      for (let i = 0; i < qty; i++) {
        allPieces.push({ w_cm: p.w, h_cm: p.h, tipo: 'manual' });
        itemsToPlace.push({
          w: p.w,
          h: p.h,
          src: 'manual'
        });
      }
    });

    // 3. Algoritmo de Nesting Simple (Next Fit Decreasing Height)
    // Ordenar por altura descendente para optimizar filas
    itemsToPlace.sort((a, b) => b.h - a.h);

    let currentX = 0;
    let currentY = 0;
    let rowMaxHeight = 0;
    const GAP = 2; // Espacio entre piezas en cm

    itemsToPlace.forEach((item) => {
      // Verificar si cabe en la fila actual
      if (currentX + item.w > boardDims.w) {
        // Pasar a siguiente fila
        currentX = 0;
        currentY += rowMaxHeight + GAP;
        rowMaxHeight = 0;
      }

      placements.push({
        x: currentX,
        y: currentY,
        w: item.w,
        h: item.h,
        qty: 1 // Cada pieza tiene su propia posición
      });

      // Actualizar posición y altura de fila
      currentX += item.w + GAP;
      rowMaxHeight = Math.max(rowMaxHeight, item.h);
    });

    onUpdatePlan(
      placements,
      totalArea,
      [],
      [{
        tipo: currentResult ? 'dxf_import_mixed' : 'manual_mixed',
        area_m2: totalArea,
        metros_lineales: totalLineales,
        dxf_url: currentResult?.dxf_url || null,
        img_url: currentResult?.img_url || null,
        piezas: allPieces
      }]
    );
  };

  const handleQuantityChange = (idx: number, val: string) => {
    const newQty = parseInt(val) || 0;
    const newQuantities = { ...quantities, [idx]: newQty };
    setQuantities(newQuantities);
    recalculatePlacements(result, newQuantities, manualPieces);
  };

  const handleBoardDimChange = (dim: 'w' | 'h', val: string) => {
    const v = parseFloat(val) || 0;
    const newDims = { ...boardDims, [dim]: v };
    setBoardDims(newDims);
    if (onUpdateBoardDimensions) {
      onUpdateBoardDimensions(newDims.w, newDims.h);
    }
  };

  const handleManualSubmit = () => {
    const w = parseFloat(manualWidth);
    const h = parseFloat(manualHeight);
    const qty = Math.max(1, parseInt(manualQty || "1", 10));

    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
      toast.error("Ingrese dimensiones válidas");
      return;
    }

    if (w > ancho || h > alto) {
      toast.error("Las dimensiones exceden el tamaño de la placa. Operación cancelada.");
      return;
    }

    // Agregar nueva pieza a la lista acumulada
    const newPiece = { w, h, qty };
    const updatedManualPieces = [...manualPieces, newPiece];
    setManualPieces(updatedManualPieces);

    // Recalcular todo (DXF + Manuales)
    recalculatePlacements(result, quantities, updatedManualPieces);

    toast.success("Pieza manual agregada");
    setIsManualOpen(false);
    setManualWidth("");
    setManualHeight("");
    setManualQty("1");
  };

  const handleDownloadTemplate = async () => {
    setIsDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/produccion/dxf/plantilla/${idProyecto}?ancho=${ancho}&alto=${alto}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      if (!response.ok) throw new Error('Error al generar la plantilla');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_${idProyecto}.dxf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Plantilla DXF descargada correctamente');
    } catch (error) {
      console.error(error);
      toast.error('Error al descargar la plantilla');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const cargados: Array<{ id: string; nombre: string; resultado: DXFResult; archivo: File }> = [];
      const token = localStorage.getItem('token');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        try {
          const response = await fetch('/api/produccion/dxf/procesar', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData,
          });

          if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
            return;
          }

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Error al procesar el archivo DXF');
          }

          const data = await response.json();
          cargados.push({
            id: Date.now().toString() + Math.random(),
            nombre: file.name,
            resultado: data,
            archivo: file
          });
        } catch (error: any) {
          console.error(`Error processing ${file.name}:`, error);
          toast.error(`Error al procesar ${file.name}: ${error.message}`);
        }
      }

      if (cargados.length > 0) {
        setPlanosManualCargados([...planosManualCargados, ...cargados]);
        toast.success(`${cargados.length} plano(s) cargado(s) exitosamente`);
      }
    } catch (error: any) {
      console.error("DXF Upload Error:", error);
      toast.error(error.message);
    } finally {
      setIsUploading(false);
      // Limpiar el input
      event.target.value = '';
    }
  };

  const handleQuickDesign = () => {
    // Usar el 90% del área del tablero como un diseño rápido (rectángulo)
    const areaM2 = (ancho * alto) / 10000;
    const areaUtilizada = areaM2 * 0.95; // Un pequeño margen

    setResult({
      metros_lineales: (ancho * 2 + alto * 2) / 100,
      area_m2: areaUtilizada,
      status: 'ok'
    });

    onUpdatePlan(
      [{ x: 0, y: 0, w: ancho, h: alto }],
      areaUtilizada,
      [],
      [{ tipo: 'quick_rect', area_m2: areaUtilizada }]
    );

    toast.success('Se ha generado un diseño rápido usando las medidas de la plancha');
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl">
      {/* Selector de Tipo de Corte */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipo de Corte</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={placaCompleta} 
            onValueChange={handleTipoCorteChange}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="completa" id="completa" />
              <Label htmlFor="completa" className="font-normal cursor-pointer">Placa Completa</Label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="recortes" id="recortes" />
              <Label htmlFor="recortes" className="font-normal cursor-pointer">Recortes Personalizados</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>


      
    </div>
  );
}
