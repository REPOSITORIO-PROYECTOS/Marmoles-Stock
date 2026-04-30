import { useEffect, useRef, useState } from 'react';
import { get, post, put, del } from '../../api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import { Package, DollarSign, Edit, Filter, Layers, Trash2, Printer, Square } from 'lucide-react';
import { RetazoMicroPlanoCanvas, type PlanoRectNorm } from './RetazoMicroPlanoCanvas';

interface Retazo {
  id: string;
  ancho: number;
  largo: number;
  area: number;
  material: string;
  color: string;
  acabado: string;
  fechaRegistro: string;
  origen: string;
  disponibleVenta: boolean;
  precioVenta?: number;
  precioSugerido: number;
  estado: 'disponible' | 'reservado' | 'vendido';
  imagenUrl?: string;
  lote?: string;
  loteId?: string;
  geometriaJson?: string | null;
}



export function StockRetazos() {
  const [retazos, setRetazos] = useState<Retazo[]>([]);
  const [materiales, setMateriales] = useState<Array<{ id: string; nombre: string; precio_m2: number }>>([]);
  const [retazoSeleccionado, setRetazoSeleccionado] = useState<Retazo | null>(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [filtroMaterial, setFiltroMaterial] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('disponible');
  const [busqueda, setBusqueda] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [nuevoMaterialId, setNuevoMaterialId] = useState('');
  const [nuevoLoteId, setNuevoLoteId] = useState('');
  const [nuevoAncho, setNuevoAncho] = useState<string>('');
  const [nuevoLargo, setNuevoLargo] = useState<string>('');
  const [precioPlanchaM2, setPrecioPlanchaM2] = useState<string>('');
  const [lotesDisponibles, setLotesDisponibles] = useState<Array<{ id: string; codigo_lote: string }>>([]);
  const [nuevoPlanoRectNorm, setNuevoPlanoRectNorm] = useState<PlanoRectNorm | null>(null);
  const [editPlanoRectNorm, setEditPlanoRectNorm] = useState<PlanoRectNorm | null>(null);
  const [modoFormaNuevo, setModoFormaNuevo] = useState<'rect' | 'poly'>('rect');
  const [polyPoints, setPolyPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [polyClosed, setPolyClosed] = useState(false);
  const [polyAreaMm2, setPolyAreaMm2] = useState(0);
  const [polyBbox, setPolyBbox] = useState<{ width: number; height: number } | null>(null);
  const [polySnapMode, setPolySnapMode] = useState(true);
  const polyCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const normalizarNombre = (s: string) => (s || '').trim().toLowerCase();

  const materialesOpciones = Array.from(
    new Map(materiales.map(m => [normalizarNombre(m.nombre), m.nombre])).values()
  );

  const materialesUnicosPorNombre = Array.from(
    new Map(materiales.map(m => [normalizarNombre(m.nombre), m])).values()
  );

  const mapRetazo = (r: any) => {
    const areaMm2 = typeof r.area_mm2 === 'number' ? r.area_mm2 : r.ancho * r.largo;
    const m2 = areaMm2 / 1_000_000;
    const pm2 = materiales.find(m => m.id === r.material_id)?.precio_m2 || 0;
    return {
      id: r.id,
      ancho: r.ancho,
      largo: r.largo,
      area: areaMm2,
      material: materiales.find(m => m.id === r.material_id)?.nombre || 'Material',
      color: '',
      acabado: 'Pulido',
      fechaRegistro: new Date().toISOString(),
      origen: 'Inventario',
      disponibleVenta: !!r.en_venta,
      precioVenta: r.precio || undefined,
      precioSugerido: Math.round(pm2 * m2),
      estado: r.estado as 'disponible' | 'reservado' | 'vendido',
      imagenUrl: undefined,
      lote: r.lote_codigo,
      loteId: r.lote_id,
      geometriaJson: r.geometria_json ?? null,
    };
  };

  const cargarRetazos = async () => {
    try {
      const rows = await get<any[]>('/api/inventario/retazos?estado=disponible');
      setRetazos(rows.map(mapRetazo));
    } catch { }
  };

  useEffect(() => {
    (async () => {
      try {
        const mats = await get<Array<{ id: string; nombre: string; precio_m2: number }>>('/api/materiales');
        setMateriales(mats);
      } catch { }
      await cargarRetazos();
    })();
  }, []);

  const retazosFiltrados = retazos.filter(retazo => {
    const cumpleMaterial = filtroMaterial === 'todos' || normalizarNombre(retazo.material) === normalizarNombre(filtroMaterial);
    const cumpleEstado = filtroEstado === 'todos' ||
      (filtroEstado === 'venta' && retazo.disponibleVenta) ||
      (filtroEstado === 'no-venta' && !retazo.disponibleVenta) ||
      retazo.estado === filtroEstado;
    const cumpleBusqueda = busqueda === '' ||
      retazo.material.toLowerCase().includes(busqueda.toLowerCase()) ||
      retazo.color.toLowerCase().includes(busqueda.toLowerCase()) ||
      retazo.origen.toLowerCase().includes(busqueda.toLowerCase());
    const noVendido = retazo.estado !== 'vendido';

    return cumpleMaterial && cumpleEstado && cumpleBusqueda && noVendido;
  });

  const retazosEnVenta = retazos.filter(r => r.disponibleVenta && r.estado === 'disponible');
  const valorInventarioVenta = retazosEnVenta.reduce((sum, r) => sum + (r.precioVenta || 0), 0);
  const areaDisponibleVentaM2 = retazosEnVenta.reduce((sum, r) => sum + r.area, 0) / 1_000_000;

  const handleToggleVenta = async (retazoId: string) => {
    const target = retazos.find(r => r.id === retazoId);
    try {
      await put(`/api/inventario/retazos/${retazoId}`, { en_venta: !target?.disponibleVenta });
      await cargarRetazos();
      const updated = retazos.find(r => r.id === retazoId);
      if (retazoSeleccionado?.id === retazoId && updated) {
        setRetazoSeleccionado({ ...retazoSeleccionado, disponibleVenta: updated.disponibleVenta, precioVenta: updated.precioVenta });
      }
    } catch { }
  };

  const handleEliminarRetazo = async (retazoId: string) => {
    if (!confirm('¿Eliminar este retazo?')) return;
    try {
      await del(`/api/inventario/retazos/${retazoId}`);
      await cargarRetazos();
    } catch { }
  };

  const handleEditarRetazo = (retazo: Retazo) => {
    setRetazoSeleccionado({
      ...retazo,
      precioVenta: retazo.precioVenta ?? retazo.precioSugerido
    });
    setEditPlanoRectNorm(null);
    if (retazo.geometriaJson) {
      try {
        const p = JSON.parse(retazo.geometriaJson) as { rect_norm?: PlanoRectNorm };
        if (p.rect_norm) setEditPlanoRectNorm(p.rect_norm);
      } catch { /* ignore */ }
    }
    setModoEdicion(true);
  };

  const handleGuardarEdicion = async () => {
    if (retazoSeleccionado) {
      try {
        const l = Math.round(retazoSeleccionado.largo);
        const w = Math.round(retazoSeleccionado.ancho);
        const geoPayload: Record<string, unknown> = {
          v: 1,
          tipo: 'rect',
          largo_mm: l,
          ancho_mm: w,
          actualizado_en: new Date().toISOString(),
        };
        if (editPlanoRectNorm) geoPayload.rect_norm = editPlanoRectNorm;
        await put(`/api/inventario/retazos/${retazoSeleccionado.id}`, {
          ancho: w,
          largo: l,
          precio: retazoSeleccionado.precioVenta,
          en_venta: retazoSeleccionado.disponibleVenta,
          geometria_json: JSON.stringify(geoPayload),
        });
        await cargarRetazos();
      } catch { }
      setModoEdicion(false);
      setRetazoSeleccionado(null);
      setEditPlanoRectNorm(null);
    }
  };
  const handleImprimirTicket = (r: Retazo) => {
    const m2 = ((r.area || 0) / 1_000_000).toFixed(2);
    const precio = (r.precioVenta || r.precioSugerido).toLocaleString();
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Ticket Retazo</title>
        <style>
          body { font-family: Arial, sans-serif; color: #333; margin: 20px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
          .title { font-size: 18px; font-weight: 800; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .item { background: #f7f7f7; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
          .label { font-size: 11px; color: #666; }
          .value { font-size: 14px; font-weight: 700; }
          .footer { margin-top: 16px; text-align: center; font-size: 12px; color: #555; }
          .price { font-size: 16px; font-weight: 900; color: #0a0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Ticket de Retazo</div>
          <div>${new Date().toLocaleString()}</div>
        </div>
        <div class="grid">
          <div class="item"><div class="label">Material</div><div class="value">${r.material}</div></div>
          <div class="item"><div class="label">Estado</div><div class="value">${r.estado}</div></div>
          <div class="item"><div class="label">Medidas</div><div class="value">${r.largo} × ${r.ancho} mm</div></div>
          <div class="item"><div class="label">Área</div><div class="value">${m2} m²</div></div>
          <div class="item"><div class="label">Lote</div><div class="value">${r.lote || '-'}</div></div>
          <div class="item"><div class="label">Origen</div><div class="value">${r.origen}</div></div>
        </div>
        <div class="footer">
          <div class="price">$${precio}</div>
        </div>
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

  const anchoNum = parseFloat(nuevoAncho) || 0;
  const largoNum = parseFloat(nuevoLargo) || 0;
  const precioM2Num = parseFloat(precioPlanchaM2) || 0;
  const rectAreaNuevoRetazoMm2 = Math.max(0, Math.round(anchoNum * largoNum));
  const areaNuevoRetazoMm2 = modoFormaNuevo === 'poly' && polyClosed && polyPoints.length >= 3 && polyAreaMm2 > 0
    ? Math.max(0, Math.round(polyAreaMm2))
    : rectAreaNuevoRetazoMm2;
  const m2NuevoRetazo = areaNuevoRetazoMm2 / 1_000_000;
  const precioEstimadoNuevoRetazo = Math.round(precioM2Num * m2NuevoRetazo);

  const polygonAreaMm2 = (pts: Array<{ x: number; y: number }>): number => {
    if (pts.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    return Math.abs(sum) / 2;
  };

  const polygonBboxMm = (pts: Array<{ x: number; y: number }>): { width: number; height: number } | null => {
    if (pts.length === 0) return null;
    let minX = pts[0].x;
    let maxX = pts[0].x;
    let minY = pts[0].y;
    let maxY = pts[0].y;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { width: maxX - minX, height: maxY - minY };
  };

  const polygonSidesMm = (pts: Array<{ x: number; y: number }>): number[] => {
    if (pts.length < 2) return [];
    const out: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const dx = pts[j].x - pts[i].x;
      const dy = pts[j].y - pts[i].y;
      out.push(Math.sqrt(dx * dx + dy * dy));
    }
    return out;
  };

  const buildGeometriaNuevo = (): string | undefined => {
    const l = Math.round(largoNum);
    const w = Math.round(anchoNum);
    if (l <= 0 || w <= 0) return undefined;

    if (modoFormaNuevo === 'poly' && polyClosed && polyPoints.length >= 3 && polyBbox && polyAreaMm2 > 0) {
      const lados = polygonSidesMm(polyPoints).map(v => Math.round(v));
      const payload: Record<string, unknown> = {
        v: 1,
        tipo: 'polygon',
        shapeType: 'polygon',
        creado_en: new Date().toISOString(),
        area_mm2: Math.round(polyAreaMm2),
        bbox: { width: Math.round(polyBbox.width), height: Math.round(polyBbox.height) },
        points: polyPoints.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })),
        lados,
        largo_mm: l,
        ancho_mm: w,
      };
      return JSON.stringify(payload);
    }

    const payload: Record<string, unknown> = {
      v: 1,
      tipo: 'rect',
      shapeType: 'rect',
      largo_mm: l,
      ancho_mm: w,
      creado_en: new Date().toISOString(),
    };
    if (nuevoPlanoRectNorm) payload.rect_norm = nuevoPlanoRectNorm;
    return JSON.stringify(payload);
  };

  useEffect(() => {
    if (!isAddDialogOpen || modoFormaNuevo !== 'poly') return;
    const canvas = polyCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (polyPoints.length === 0) return;

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(polyPoints[0].x, polyPoints[0].y);
      for (let i = 1; i < polyPoints.length; i++) ctx.lineTo(polyPoints[i].x, polyPoints[i].y);
      if (polyClosed) ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#0ea5e9';
      for (const p of polyPoints) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (polyPoints.length > 1) {
        ctx.font = '12px Arial';
        ctx.fillStyle = '#111827';
        const maxIdx = polyClosed ? polyPoints.length : polyPoints.length - 1;
        for (let i = 0; i < maxIdx; i++) {
          const p1 = polyPoints[i];
          const p2 = polyPoints[(i + 1) % polyPoints.length];
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          ctx.fillText(`${dist.toFixed(0)} mm`, midX + 6, midY - 6);
        }
      }
    };

    draw();
  }, [isAddDialogOpen, modoFormaNuevo, polyClosed, polyPoints]);

  useEffect(() => {
    if (!isAddDialogOpen || modoFormaNuevo !== 'poly') return;
    const canvas = polyCanvasRef.current;
    if (!canvas) return;
    const handleCanvasClick = (e: MouseEvent) => {
      if (polyClosed) return;
      const rect = canvas.getBoundingClientRect();
      const sx = rect.width > 0 ? canvas.width / rect.width : 1;
      const sy = rect.height > 0 ? canvas.height / rect.height : 1;
      let x = (e.clientX - rect.left) * sx;
      let y = (e.clientY - rect.top) * sy;

      if (polySnapMode && polyPoints.length > 0) {
        const last = polyPoints[polyPoints.length - 1];
        const dx = x - last.x;
        const dy = y - last.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          y = last.y;
        } else {
          x = last.x;
        }
      }

      console.log('Click:', { x, y, snapMode: polySnapMode });
      setPolyPoints(prev => [...prev, { x, y }]);
    };

    canvas.onclick = null;
    canvas.onclick = handleCanvasClick as any;
    return () => {
      canvas.onclick = null;
    };
  }, [isAddDialogOpen, modoFormaNuevo, polyClosed, polySnapMode, polyPoints]);

  useEffect(() => {
    if (modoFormaNuevo !== 'poly') return;
    if (!polyClosed || polyPoints.length < 3) {
      setPolyAreaMm2(0);
      setPolyBbox(null);
      return;
    }
    const area = polygonAreaMm2(polyPoints);
    const bbox = polygonBboxMm(polyPoints);
    setPolyAreaMm2(area);
    setPolyBbox(bbox);
    if (bbox) {
      setNuevoLargo(String(Math.max(0, Math.round(bbox.width))));
      setNuevoAncho(String(Math.max(0, Math.round(bbox.height))));
    }
  }, [modoFormaNuevo, polyClosed, polyPoints]);

  const handleCrearNuevoRetazo = async () => {
    if (!nuevoMaterialId || anchoNum <= 0 || largoNum <= 0 || precioM2Num <= 0) return;
    try {
      const geo = buildGeometriaNuevo();
      await post('/api/inventario/retazos', {
        material_id: nuevoMaterialId,
        lote_id: nuevoLoteId || undefined,
        ancho: Math.round(anchoNum),
        largo: Math.round(largoNum),
        precio: precioEstimadoNuevoRetazo || 0,
        espesor: 20,
        ubicacion: 'Inventario General',
        geometria_json: geo,
      });
      await cargarRetazos();
      setIsAddDialogOpen(false);
      setNuevoMaterialId('');
      setNuevoLoteId('');
      setNuevoAncho('');
      setNuevoLargo('');
      setPrecioPlanchaM2('');
      setLotesDisponibles([]);
      setNuevoPlanoRectNorm(null);
      setModoFormaNuevo('rect');
      setPolyPoints([]);
      setPolyClosed(false);
      setPolyAreaMm2(0);
      setPolyBbox(null);
      setPolySnapMode(true);
    } catch { }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Stock de Retazos</h1>
        <p className="text-sm text-gray-600">Gestión de retazos disponibles en inventario</p>
      </div>

      {/* Resumen */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Retazos en Venta</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{retazosEnVenta.length} unidades</p>
              </div>
              <Package className="h-8 w-8 text-cyan-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Área Disponible</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{areaDisponibleVentaM2.toFixed(2)} m²</p>
              </div>
              <Layers className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Valor Total</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">${valorInventarioVenta.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Package className="h-4 w-4 mr-2" />
              Añadir Retazo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="busqueda" className="text-sm">Buscar</Label>
              <Input
                id="busqueda"
                placeholder="Material, color..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="material" className="text-sm">Material</Label>
              <Select value={filtroMaterial} onValueChange={setFiltroMaterial}>
                <SelectTrigger id="material">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {materialesOpciones.map(material => (
                    <SelectItem key={material} value={material}>{material}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="estado" className="text-sm">Estado</Label>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger id="estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="venta">En venta</SelectItem>
                  <SelectItem value="no-venta">No en venta</SelectItem>
                  <SelectItem value="disponible">Disponible</SelectItem>
                  <SelectItem value="reservado">Reservado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setBusqueda('');
                  setFiltroMaterial('todos');
                  setFiltroEstado('disponible');
                }}
              >
                Limpiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listado de Retazos */}
      <Card>
        <CardHeader>
          <CardTitle>Catálogo de Retazos ({retazosFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {retazosFiltrados.map(retazo => (
              <Card key={retazo.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* Imagen */}
                <div className="h-32 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                  {retazo.imagenUrl ? (
                    <img src={retazo.imagenUrl} alt={retazo.material} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-16 w-16 text-gray-400" />
                  )}
                </div>

                {/* Contenido */}
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 truncate">{retazo.material}</p>
                      {retazo.color && <p className="text-sm text-gray-600">{retazo.color}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {retazo.disponibleVenta && (
                        <Badge className="bg-green-100 text-green-800 text-xs">En venta</Badge>
                      )}
                      {retazo.geometriaJson && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Square className="h-3 w-3" /> Plano
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Medidas */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Medidas:</span>
                      <span className="font-medium text-gray-900">{retazo.largo} × {retazo.ancho} mm</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Área:</span>
                      <span className="font-medium text-gray-900">{((retazo.area || 0) / 1_000_000).toFixed(2)} m²</span>
                    </div>
                    {retazo.lote && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Lote:</span>
                        <span className="font-medium text-gray-900">{retazo.lote}</span>
                      </div>
                    )}
                  </div>

                  {/* Precio y venta */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={retazo.disponibleVenta}
                        onCheckedChange={() => handleToggleVenta(retazo.id)}
                        disabled={retazo.estado === 'vendido'}
                      />
                      <span className="text-sm text-gray-600">Venta</span>
                    </div>
                    {retazo.disponibleVenta && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          ${(retazo.precioVenta || retazo.precioSugerido).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEditarRetazo(retazo)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleImprimirTicket(retazo)}
                    >
                      <Printer className="h-3 w-3 mr-1" />
                      Imprimir Ticket
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleEliminarRetazo(retazo.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {retazosFiltrados.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay retazos que coincidan con los filtros</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Añadir Retazo */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) {
          setNuevoPlanoRectNorm(null);
          setModoFormaNuevo('rect');
          setPolyPoints([]);
          setPolyClosed(false);
          setPolyAreaMm2(0);
          setPolyBbox(null);
          setPolySnapMode(true);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Añadir Retazo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={modoFormaNuevo === 'rect' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setModoFormaNuevo('rect')}
              >
                Rectángulo
              </Button>
              <Button
                type="button"
                variant={modoFormaNuevo === 'poly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setModoFormaNuevo('poly');
                  setPolySnapMode(true);
                }}
              >
                Forma libre
              </Button>
            </div>
            <div>
              <Label htmlFor="material-nuevo" className="text-sm">Material</Label>
              <Select value={nuevoMaterialId} onValueChange={async (v) => {
                setNuevoMaterialId(v);
                const mat = materiales.find(m => m.id === v);
                setPrecioPlanchaM2(String(mat?.precio_m2 ?? ''));
                try {
                  const lots = await get<Array<{ id: string; codigo_lote: string }>>(`/api/lotes?material_id=${v}`);
                  const list = Array.isArray(lots) ? lots : [];
                  setLotesDisponibles(list);
                  setNuevoLoteId(list[0]?.id || '');
                } catch {
                  setLotesDisponibles([]);
                  setNuevoLoteId('');
                }
              }}>
                <SelectTrigger id="material-nuevo">
                  <SelectValue placeholder="Seleccionar material" />
                </SelectTrigger>
                <SelectContent>
                  {materialesUnicosPorNombre.map(material => (
                    <SelectItem key={material.id} value={material.id}>{material.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {nuevoMaterialId && (
              <div>
                <Label htmlFor="lote-nuevo" className="text-sm">Lote</Label>
                <Select value={nuevoLoteId} onValueChange={setNuevoLoteId} disabled={lotesDisponibles.length === 0}>
                  <SelectTrigger id="lote-nuevo">
                    <SelectValue placeholder={lotesDisponibles.length === 0 ? "Sin lotes disponibles" : "Seleccionar lote"} />
                  </SelectTrigger>
                  <SelectContent>
                    {lotesDisponibles.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.codigo_lote}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="largo-nuevo" className="text-sm">Largo (mm)</Label>
                <Input
                  id="largo-nuevo"
                  type="number"
                  value={nuevoLargo}
                  onChange={(e) => setNuevoLargo(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ancho-nuevo" className="text-sm">Ancho (mm)</Label>
                <Input
                  id="ancho-nuevo"
                  type="number"
                  value={nuevoAncho}
                  onChange={(e) => setNuevoAncho(e.target.value)}
                />
              </div>
            </div>

            {modoFormaNuevo === 'rect' ? (
              <RetazoMicroPlanoCanvas
                largoMm={Math.max(50, Math.round(largoNum) || 800)}
                anchoMm={Math.max(50, Math.round(anchoNum) || 400)}
                onMedidasChange={(l, w) => {
                  setNuevoLargo(String(l));
                  setNuevoAncho(String(w));
                }}
                onPlanoChange={(d) => setNuevoPlanoRectNorm(d?.rect_norm ?? null)}
              />
            ) : (
              <div className="space-y-3">
                <canvas
                  ref={polyCanvasRef}
                  width={420}
                  height={260}
                  className="w-full border border-gray-200 rounded-lg bg-white"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPolySnapMode(v => {
                      const next = !v;
                      console.log('Snap:', next);
                      return next;
                    })}
                  >
                    {polySnapMode ? 'Modo: Recto' : 'Modo: Libre'}
                  </Button>
                  <div className="text-xs text-gray-600">
                    {polySnapMode ? 'Modo actual: Recto' : 'Modo actual: Libre'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPolyClosed(false);
                      setPolyPoints(prev => prev.slice(0, -1));
                    }}
                    disabled={polyPoints.length === 0}
                  >
                    Deshacer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (polyPoints.length < 3) {
                        alert('Mínimo 3 puntos');
                        return;
                      }
                      setPolyClosed(true);
                    }}
                    disabled={polyClosed || polyPoints.length < 3}
                  >
                    Cerrar forma
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPolyPoints([]);
                      setPolyClosed(false);
                      setPolyAreaMm2(0);
                      setPolyBbox(null);
                      setPolySnapMode(true);
                    }}
                    disabled={polyPoints.length === 0 && !polyClosed}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Área</Label>
                <div className="p-2 border rounded-md text-sm font-medium bg-gray-50">
                  {m2NuevoRetazo.toFixed(2)} m²
                </div>
              </div>
              <div>
                <Label htmlFor="precio-m2" className="text-sm">Precio (m²)</Label
                >
                <Input
                  id="precio-m2"
                  type="number"
                  value={precioPlanchaM2}
                  onChange={(e) => setPrecioPlanchaM2(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm">Precio estimado</Label>
              <div className="p-2 border rounded-md text-lg font-bold text-gray-900 bg-gray-50">
                ${precioEstimadoNuevoRetazo.toLocaleString()}
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!nuevoMaterialId || areaNuevoRetazoMm2 <= 0 || precioM2Num <= 0}
              onClick={handleCrearNuevoRetazo}
            >
              Crear Retazo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Retazo */}
      <Dialog open={modoEdicion} onOpenChange={(open) => {
        setModoEdicion(open);
        if (!open) {
          setRetazoSeleccionado(null);
          setEditPlanoRectNorm(null);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Retazo</DialogTitle>
          </DialogHeader>
          {retazoSeleccionado && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="largo" className="text-sm">Largo (mm)</Label>
                  <Input
                    id="largo"
                    type="number"
                    value={retazoSeleccionado.largo}
                    onChange={(e) => setRetazoSeleccionado({
                      ...retazoSeleccionado,
                      largo: parseFloat(e.target.value),
                      area: retazoSeleccionado.ancho * parseFloat(e.target.value)
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="ancho" className="text-sm">Ancho (mm)</Label>
                  <Input
                    id="ancho"
                    type="number"
                    value={retazoSeleccionado.ancho}
                    onChange={(e) => setRetazoSeleccionado({
                      ...retazoSeleccionado,
                      ancho: parseFloat(e.target.value),
                      area: parseFloat(e.target.value) * retazoSeleccionado.largo
                    })}
                  />
                </div>
              </div>

              <RetazoMicroPlanoCanvas
                largoMm={Math.max(50, Math.round(retazoSeleccionado.largo) || 800)}
                anchoMm={Math.max(50, Math.round(retazoSeleccionado.ancho) || 400)}
                onMedidasChange={(l, w) => setRetazoSeleccionado({
                  ...retazoSeleccionado,
                  largo: l,
                  ancho: w,
                  area: l * w,
                })}
                onPlanoChange={(d) => setEditPlanoRectNorm(d?.rect_norm ?? null)}
              />

              <div>
                <Label className="text-sm">Área</Label>
                <div className="p-2 border rounded-md text-sm font-medium bg-gray-50">
                  {((retazoSeleccionado.area || 0) / 1_000_000).toFixed(2)} m²
                </div>
              </div>

              <div>
                <Label htmlFor="precio-edit" className="text-sm">Precio de Venta</Label>
                <Input
                  id="precio-edit"
                  type="number"
                  value={retazoSeleccionado.precioVenta || retazoSeleccionado.precioSugerido}
                  onChange={(e) => setRetazoSeleccionado({
                    ...retazoSeleccionado,
                    precioVenta: parseFloat(e.target.value)
                  })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Sugerido: ${retazoSeleccionado.precioSugerido.toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={retazoSeleccionado.disponibleVenta}
                  onCheckedChange={(checked) => setRetazoSeleccionado({
                    ...retazoSeleccionado,
                    disponibleVenta: checked
                  })}
                />
                <Label className="text-sm">Disponible para venta</Label>
              </div>

              <Button onClick={handleGuardarEdicion} className="w-full">
                Guardar Cambios
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

