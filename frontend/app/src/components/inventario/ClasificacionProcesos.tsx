import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { post } from '../../api';

type ProcesoItem = {
  id: string;
  tipo: 'corte' | 'agujero' | 'bacha' | 'rebaje' | 'otro';
  cantidad: number;
  unidad: string;
  descripcion?: string;
  ordenTrabajoId?: string;
  fecha: string;
  costoUnitario?: number;
};

const tipos = [
  { v: 'corte', l: 'Corte de material' },
  { v: 'agujero', l: 'Agujero realizado' },
  { v: 'bacha', l: 'Bacha' },
  { v: 'rebaje', l: 'Rebaje' },
  { v: 'otro', l: 'Otro proceso' },
];

function loadLocal(): ProcesoItem[] {
  try { const raw = localStorage.getItem('procesos_inventario'); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveLocal(items: ProcesoItem[]) { try { localStorage.setItem('procesos_inventario', JSON.stringify(items)); } catch {} }

export function ClasificacionProcesos() {
  const [items, setItems] = useState<ProcesoItem[]>([]);
  const [nuevo, setNuevo] = useState<Partial<ProcesoItem>>({ tipo: 'corte', cantidad: 1, unidad: 'unidad', fecha: new Date().toISOString().slice(0,10) });
  const [desde, setDesde] = useState<string>('');
  const [hasta, setHasta] = useState<string>('');
  const [tipoFiltro, setTipoFiltro] = useState<string>('');
  const servicios = [
    { key: 'instalacion', nombre: 'Instalación', tarifa: 20000 },
    { key: 'traslado', nombre: 'Traslado', tarifa: 15000 },
    { key: 'sellado', nombre: 'Sellado', tarifa: 8000 },
    { key: 'pulido', nombre: 'Pulido', tarifa: 12000 },
    { key: 'cantos', nombre: 'Cantos', tarifa: 6000 },
    { key: 'bacha', nombre: 'Bacha', tarifa: 10000 },
    { key: 'rebaje', nombre: 'Rebaje', tarifa: 9000 },
  ];
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<Record<string, boolean>>({});

  useEffect(() => { setItems(loadLocal()); }, []);

  const agregar = async () => {
    if (!nuevo.tipo || !nuevo.cantidad || !nuevo.unidad || !nuevo.fecha) return;
    const item: ProcesoItem = {
      id: Date.now().toString(),
      tipo: nuevo.tipo as any,
      cantidad: Number(nuevo.cantidad),
      unidad: String(nuevo.unidad),
      descripcion: nuevo.descripcion || '',
      ordenTrabajoId: nuevo.ordenTrabajoId || '',
      fecha: String(nuevo.fecha),
      costoUnitario: nuevo.costoUnitario ? Number(nuevo.costoUnitario) : undefined,
    };
    const serviciosItems: ProcesoItem[] = Object.keys(serviciosSeleccionados)
      .filter(k => serviciosSeleccionados[k])
      .map(k => {
        const svc = servicios.find(s => s.key === k)!;
        return { id: Date.now().toString() + '-' + k, tipo: 'otro', cantidad: 1, unidad: 'servicio', descripcion: svc.nombre, ordenTrabajoId: nuevo.ordenTrabajoId || '', fecha: String(nuevo.fecha), costoUnitario: svc.tarifa };
      });
    const arr = [...serviciosItems, item, ...items];
    setItems(arr);
    saveLocal(arr);
    try {
      await post('/api/inventario/procesos', { procesos: [item, ...serviciosItems] });
    } catch {}
  };

  const filtered = useMemo(() => {
    return items.filter(i => {
      const f = (!tipoFiltro || i.tipo === tipoFiltro);
      const d = (!desde || i.fecha >= desde) && (!hasta || i.fecha <= hasta);
      return f && d;
    });
  }, [items, tipoFiltro, desde, hasta]);

  const totalCosto = useMemo(() => filtered.reduce((s, i) => s + ((i.costoUnitario || 0) * i.cantidad), 0), [filtered]);
  const totalServicios = useMemo(() => Object.keys(serviciosSeleccionados).filter(k => serviciosSeleccionados[k]).reduce((s, k) => s + (servicios.find(sv => sv.key === k)?.tarifa || 0), 0), [serviciosSeleccionados]);

  const exportCSV = () => {
    const headers = ['id','tipo','cantidad','unidad','descripcion','ordenTrabajoId','fecha','costoUnitario','costoTotal'];
    const rows = filtered.map(i => [i.id,i.tipo,i.cantidad,i.unidad,i.descripcion||'',i.ordenTrabajoId||'',i.fecha,(i.costoUnitario||0),(i.costoUnitario||0)*i.cantidad]);
    const csv = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'procesos_inventario.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Clasificación de Procesos Especiales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 p-3 border rounded">
            <Label>Servicios adicionales</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {servicios.map(s => (
                <label key={s.key} className="flex items-center gap-2 p-2 border rounded">
                  <input type="checkbox" checked={!!serviciosSeleccionados[s.key]} onChange={(e) => setServiciosSeleccionados({ ...serviciosSeleccionados, [s.key]: e.target.checked })} />
                  <span className="flex-1">{s.nombre}</span>
                  <span className="text-sm">${s.tarifa.toLocaleString()}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={String(nuevo.tipo)} onValueChange={(v)=>setNuevo({ ...nuevo, tipo: v as any })}>
                <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
                <SelectContent>{tipos.map(t=> (<SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input type="number" value={nuevo.cantidad || ''} onChange={(e)=>setNuevo({ ...nuevo, cantidad: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Unidad</Label>
              <Input value={nuevo.unidad || ''} onChange={(e)=>setNuevo({ ...nuevo, unidad: e.target.value })} placeholder="unidad, cm, mm" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={nuevo.fecha || ''} onChange={(e)=>setNuevo({ ...nuevo, fecha: e.target.value })} />
            </div>
            <div>
              <Label>Orden de Trabajo</Label>
              <Input value={nuevo.ordenTrabajoId || ''} onChange={(e)=>setNuevo({ ...nuevo, ordenTrabajoId: e.target.value })} placeholder="ID OT" />
            </div>
            <div>
              <Label>Costo unitario</Label>
              <Input type="number" value={nuevo.costoUnitario || ''} onChange={(e)=>setNuevo({ ...nuevo, costoUnitario: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="md:col-span-2">
              <Label>Descripción</Label>
              <Input value={nuevo.descripcion || ''} onChange={(e)=>setNuevo({ ...nuevo, descripcion: e.target.value })} placeholder="Detalle del proceso" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Button onClick={agregar}>Registrar Proceso</Button>
            <Button variant="outline" onClick={exportCSV}>Exportar CSV</Button>
            <div className="p-2 bg-gray-50 border rounded">Total costo: ${ (totalCosto + totalServicios).toLocaleString() }</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border rounded">
            <div>
              <Label>Desde</Label>
              <Input type="date" value={desde} onChange={(e)=>setDesde(e.target.value)} />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input type="date" value={hasta} onChange={(e)=>setHasta(e.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger><SelectValue placeholder="Todos"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {tipos.map(t=> (<SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            {filtered.length === 0 && (<p className="text-sm text-gray-600">Sin registros</p>)}
            {filtered.map(i => (
              <div key={i.id} className="p-3 border rounded">
                <div className="flex justify-between">
                  <span className="font-medium">{tipos.find(t=>t.v===i.tipo)?.l}</span>
                  <span className="text-sm">{i.fecha}</span>
                </div>
                <p className="text-sm text-gray-600">Cantidad: {i.cantidad} {i.unidad} {i.costoUnitario ? `• Costo unitario: $${i.costoUnitario.toLocaleString()}` : ''}</p>
                {i.descripcion && (<p className="text-sm text-gray-600">{i.descripcion}</p>)}
                {i.ordenTrabajoId && (<p className="text-sm text-gray-600">OT: {i.ordenTrabajoId}</p>)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
