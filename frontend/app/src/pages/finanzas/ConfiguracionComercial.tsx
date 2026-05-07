import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { get, post, put, del } from '../../api';
import { toast } from 'sonner';
import { Plus, Save, Trash2, Settings2, Tags } from 'lucide-react';

type Servicio = {
  id: string;
  nombre: string;
  categoria: string;
  precio_base: number;
  unidad?: string;
};

type EditMap = Record<string, { nombre: string; precio_base: number; unidad?: string }>;

const NUEVO_DESCUENTO = {
  nombre: '',
  precio_base: 0,
  unidad: '%',
};

const NUEVO_EXTRA = {
  nombre: '',
  precio_base: 0,
  unidad: 'u',
};

const PAGE_SIZE = 8;

export function ConfiguracionComercial() {
  const [descuentos, setDescuentos] = useState<Servicio[]>([]);
  const [extras, setExtras] = useState<Servicio[]>([]);
  const [editMap, setEditMap] = useState<EditMap>({});
  const [nuevoDescuento, setNuevoDescuento] = useState(NUEVO_DESCUENTO);
  const [nuevoExtra, setNuevoExtra] = useState(NUEVO_EXTRA);
  const [loading, setLoading] = useState(false);
  const [searchDescuentos, setSearchDescuentos] = useState('');
  const [searchExtras, setSearchExtras] = useState('');
  const [pageDescuentos, setPageDescuentos] = useState(1);
  const [pageExtras, setPageExtras] = useState(1);

  const hasCambios = useMemo(() => Object.keys(editMap).length > 0, [editMap]);

  const cargarCatalogos = async () => {
    setLoading(true);
    try {
      const [resDescuentos, resExtrasMaestro] = await Promise.all([
        get<Servicio[]>('/api/servicios?categoria=DescuentoPresupuesto'),
        /** Misma fuente que el desplegable del constructor: ExtraPresupuesto + extra_pieza (altas desde pieza / tests). */
        get<
          Array<{
            id: string;
            nombre: string;
            precio_base: number;
            unidad?: string;
            categoria?: string;
          }>
        >('/api/presupuestos/maestros/extras'),
      ]);
      setDescuentos(Array.isArray(resDescuentos) ? resDescuentos : []);
      const rawExt = Array.isArray(resExtrasMaestro) ? resExtrasMaestro : [];
      setExtras(
        rawExt.map((x) => ({
          id: x.id,
          nombre: x.nombre,
          categoria: x.categoria || '—',
          precio_base: Number(x.precio_base ?? 0),
          unidad: x.unidad,
        })),
      );
      setEditMap({});
      setPageDescuentos(1);
      setPageExtras(1);
    } catch (err) {
      toast.error('No se pudieron cargar los catálogos comerciales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  const onEdit = (item: Servicio, patch: Partial<Servicio>) => {
    const base = editMap[item.id] || {
      nombre: item.nombre,
      precio_base: Number(item.precio_base || 0),
      unidad: item.unidad || '',
    };
    setEditMap((prev) => ({
      ...prev,
      [item.id]: {
        ...base,
        ...patch,
      },
    }));
  };

  const getValue = (item: Servicio) => editMap[item.id] || {
    nombre: item.nombre,
    precio_base: Number(item.precio_base || 0),
    unidad: item.unidad || '',
  };

  const guardarCambios = async () => {
    const entries = Object.entries(editMap);
    if (!entries.length) return;

    try {
      await Promise.all(entries.map(([id, data]) =>
        put(`/api/servicios/${id}`, {
          nombre: data.nombre,
          precio_base: Number(data.precio_base || 0),
          unidad: data.unidad,
        })
      ));
      toast.success('Catálogo comercial actualizado');
      await cargarCatalogos();
    } catch (err) {
      toast.error('Error al guardar cambios');
    }
  };

  const crearDescuento = async () => {
    if (!nuevoDescuento.nombre.trim()) {
      toast.error('Ingrese un nombre para el descuento');
      return;
    }
    try {
      await post('/api/servicios', {
        nombre: nuevoDescuento.nombre.trim(),
        categoria: 'DescuentoPresupuesto',
        precio_base: Number(nuevoDescuento.precio_base || 0),
        unidad: nuevoDescuento.unidad,
      });
      setNuevoDescuento(NUEVO_DESCUENTO);
      toast.success('Plantilla de descuento creada');
      await cargarCatalogos();
    } catch (err) {
      toast.error('No se pudo crear la plantilla de descuento');
    }
  };

  const crearExtra = async () => {
    if (!nuevoExtra.nombre.trim()) {
      toast.error('Ingrese un nombre para el extra');
      return;
    }
    try {
      await post('/api/servicios', {
        nombre: nuevoExtra.nombre.trim(),
        categoria: 'ExtraPresupuesto',
        precio_base: Number(nuevoExtra.precio_base || 0),
        unidad: nuevoExtra.unidad,
      });
      setNuevoExtra(NUEVO_EXTRA);
      toast.success('Extra creado');
      await cargarCatalogos();
    } catch (err) {
      toast.error('No se pudo crear el extra');
    }
  };

  const eliminarItem = async (id: string) => {
    if (!confirm('¿Eliminar ítem del catálogo?')) return;
    try {
      await del(`/api/servicios/${id}`);
      toast.success('Ítem eliminado');
      await cargarCatalogos();
    } catch {
      toast.error('No se pudo eliminar (ventas: solo catálogo comercial / extras de pieza; resto requiere admin)');
    }
  };

  const limpiarDescuentos = async () => {
    if (!descuentos.length) {
      toast.info('No hay descuentos para limpiar.');
      return;
    }
    const ok = window.confirm(
      `Se eliminarán ${descuentos.length} descuentos del catálogo. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    const clave = window.prompt('Para confirmar escriba LIMPIAR');
    if (clave !== 'LIMPIAR') {
      toast.error('Confirmación inválida.');
      return;
    }
    setLoading(true);
    try {
      await Promise.all(descuentos.map((d) => del(`/api/servicios/${d.id}`)));
      setEditMap({});
      toast.success('Lista de descuentos limpiada.');
      await cargarCatalogos();
    } catch {
      toast.error('No se pudo limpiar la lista de descuentos.');
    } finally {
      setLoading(false);
    }
  };

  const descuentosFiltrados = useMemo(() => {
    const term = searchDescuentos.trim().toLowerCase();
    if (!term) return descuentos;
    return descuentos.filter((d) => {
      const txt = `${d.nombre} ${d.unidad || ''} ${d.precio_base}`.toLowerCase();
      return txt.includes(term);
    });
  }, [descuentos, searchDescuentos]);

  const extrasFiltrados = useMemo(() => {
    const term = searchExtras.trim().toLowerCase();
    if (!term) return extras;
    return extras.filter((e) => {
      const txt = `${e.nombre} ${e.unidad || ''} ${e.precio_base} ${e.categoria || ''}`.toLowerCase();
      return txt.includes(term);
    });
  }, [extras, searchExtras]);

  const totalPagesDescuentos = Math.max(1, Math.ceil(descuentosFiltrados.length / PAGE_SIZE));
  const totalPagesExtras = Math.max(1, Math.ceil(extrasFiltrados.length / PAGE_SIZE));

  const descuentosPagina = useMemo(() => {
    const start = (pageDescuentos - 1) * PAGE_SIZE;
    return descuentosFiltrados.slice(start, start + PAGE_SIZE);
  }, [descuentosFiltrados, pageDescuentos]);

  const extrasPagina = useMemo(() => {
    const start = (pageExtras - 1) * PAGE_SIZE;
    return extrasFiltrados.slice(start, start + PAGE_SIZE);
  }, [extrasFiltrados, pageExtras]);

  const renderCatalogo = (
    items: Servicio[],
    tipo: 'descuento' | 'extra',
    page: number,
    totalPages: number,
    onPrev: () => void,
    onNext: () => void,
  ) => {
    return (
      <div className="space-y-3">
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground border rounded-md p-4 bg-muted/30">
            Sin elementos cargados.
          </div>
        )}
        {items.map((item) => {
          const value = getValue(item);
          return (
            <div key={item.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_120px_40px] gap-2 items-center border rounded-md p-3">
              <div className="space-y-1 min-w-0">
                <Input
                  value={value.nombre}
                  onChange={(e) => onEdit(item, { nombre: e.target.value })}
                  placeholder={tipo === 'descuento' ? 'Nombre descuento' : 'Nombre extra'}
                />
                {tipo === 'extra' && item.categoria ? (
                  <p className="text-[11px] text-muted-foreground truncate" title={item.categoria}>
                    Categoría: {item.categoria}
                  </p>
                ) : null}
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={String(value.precio_base)}
                onChange={(e) => onEdit(item, { precio_base: Number(e.target.value || 0) })}
              />
              <Input
                value={value.unidad || ''}
                onChange={(e) => onEdit(item, { unidad: e.target.value })}
                placeholder={tipo === 'descuento' ? '% o $' : 'u'}
              />
              <Button
                variant="destructive"
                size="icon"
                onClick={() => eliminarItem(item.id)}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
        {items.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages}>
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-foreground">Configuración Comercial</h3>
          <p className="text-sm text-muted-foreground">
            Gestione descuentos y el mismo catálogo de extras que el desplegable del presupuesto (incluye altas desde
            pieza y pruebas con categoría extra_pieza).
          </p>
        </div>
        <Button onClick={guardarCambios} disabled={!hasCambios || loading} className="gap-2">
          <Save className="h-4 w-4" /> Guardar cambios
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2"><Tags className="h-4 w-4" /> Descuentos (plantillas)</CardTitle>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={limpiarDescuentos}
                disabled={loading || descuentos.length === 0}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Limpiar lista
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Buscar descuento</Label>
              <Input
                value={searchDescuentos}
                onChange={(e) => {
                  setSearchDescuentos(e.target.value);
                  setPageDescuentos(1);
                }}
                placeholder="Buscar por nombre, valor o unidad"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_150px_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label>Nombre</Label>
                <Input
                  value={nuevoDescuento.nombre}
                  onChange={(e) => setNuevoDescuento((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Descuento Empresa"
                />
              </div>
              <div className="space-y-1">
                <Label>Valor</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={String(nuevoDescuento.precio_base)}
                  onChange={(e) => setNuevoDescuento((p) => ({ ...p, precio_base: Number(e.target.value || 0) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Unidad</Label>
                <Select
                  value={nuevoDescuento.unidad}
                  onValueChange={(val) => setNuevoDescuento((p) => ({ ...p, unidad: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="%">%</SelectItem>
                    <SelectItem value="$">$</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={crearDescuento} className="gap-1"><Plus className="h-4 w-4" /> Alta</Button>
            </div>

            {renderCatalogo(
              descuentosPagina,
              'descuento',
              pageDescuentos,
              totalPagesDescuentos,
              () => setPageDescuentos((p) => Math.max(1, p - 1)),
              () => setPageDescuentos((p) => Math.min(totalPagesDescuentos, p + 1)),
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Extras (catálogo)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Buscar extra</Label>
              <Input
                value={searchExtras}
                onChange={(e) => {
                  setSearchExtras(e.target.value);
                  setPageExtras(1);
                }}
                placeholder="Buscar por nombre, precio o unidad"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_120px_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label>Nombre</Label>
                <Input
                  value={nuevoExtra.nombre}
                  onChange={(e) => setNuevoExtra((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Acarreo adicional"
                />
              </div>
              <div className="space-y-1">
                <Label>Precio</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={String(nuevoExtra.precio_base)}
                  onChange={(e) => setNuevoExtra((p) => ({ ...p, precio_base: Number(e.target.value || 0) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Unidad</Label>
                <Input
                  value={nuevoExtra.unidad}
                  onChange={(e) => setNuevoExtra((p) => ({ ...p, unidad: e.target.value || 'u' }))}
                />
              </div>
              <Button onClick={crearExtra} className="gap-1"><Plus className="h-4 w-4" /> Alta</Button>
            </div>

            {renderCatalogo(
              extrasPagina,
              'extra',
              pageExtras,
              totalPagesExtras,
              () => setPageExtras((p) => Math.max(1, p - 1)),
              () => setPageExtras((p) => Math.min(totalPagesExtras, p + 1)),
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
