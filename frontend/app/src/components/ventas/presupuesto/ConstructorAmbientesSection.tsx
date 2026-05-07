import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Dialog } from '../../ui/dialog';
import { PresupuestoModalShell } from './PresupuestoModalShell';
import { Plus, Trash2, Pencil, Package, Layers } from 'lucide-react';
import { toast } from 'sonner';
import type { usePresupuestoMaestros } from '../../../hook/usePresupuestoMaestros';
import type { ExtraMaestro, MaterialMaestro } from '../../../hook/usePresupuestoMaestros';
import {
  ambienteVacio,
  formatLargoAnchoMLineaMedida,
  nuevoId,
  notaTrasSincroDimensiones,
  piezaVacia,
  metrosCuadradosPieza,
  subtotalMaterialPieza,
  type AmbientePresupuesto,
  type ExtraEnPieza,
  type PiezaPresupuesto,
} from '../../../types/presupuestoConstructor';

type Maestros = ReturnType<typeof usePresupuestoMaestros>;

type Props = {
  ambientes: AmbientePresupuesto[];
  setAmbientes: React.Dispatch<React.SetStateAction<AmbientePresupuesto[]>>;
  materiales: MaterialMaestro[];
  extrasCat: ExtraMaestro[];
  refreshMateriales: () => Promise<void>;
  refreshExtras: () => Promise<void>;
  maestros: Maestros;
};

export function ConstructorAmbientesSection({
  ambientes,
  setAmbientes,
  materiales,
  extrasCat,
  refreshMateriales,
  refreshExtras,
  maestros,
}: Props) {
  const [matModal, setMatModal] = useState<'nuevo' | 'precio' | null>(null);
  const [matPrecioTarget, setMatPrecioTarget] = useState<MaterialMaestro | null>(null);
  const [matNuevoNombre, setMatNuevoNombre] = useState('');
  const [matNuevoPrecio, setMatNuevoPrecio] = useState('');
  const [matEditPrecio, setMatEditPrecio] = useState('');

  const [exModal, setExModal] = useState<'nuevo' | 'precio' | null>(null);
  const [exTargetPieza, setExTargetPieza] = useState<{ ambId: string; piezaId: string } | null>(null);
  const [exMaestro, setExMaestro] = useState<ExtraMaestro | null>(null);
  const [exNuevoNombre, setExNuevoNombre] = useState('');
  const [exNuevoPrecio, setExNuevoPrecio] = useState('');
  const [exEditPrecio, setExEditPrecio] = useState('');
  const [exCantidad, setExCantidad] = useState('1');
  /** Extra en modal principal: catálogo, precio editable, cantidad */
  const [exSelId, setExSelId] = useState<string>('');
  const [exPrecioLinea, setExPrecioLinea] = useState('');

  const updateAmbiente = (id: string, fn: (a: AmbientePresupuesto) => AmbientePresupuesto) => {
    setAmbientes((prev) => prev.map((a) => (a.id === id ? fn(a) : a)));
  };

  const addAmbiente = () => setAmbientes((prev) => [...prev, ambienteVacio(`Ambiente ${prev.length + 1}`)]);

  const removeAmbiente = (id: string) => {
    setAmbientes((prev) => (prev.length <= 1 ? prev : prev.filter((a) => a.id !== id)));
  };

  const addPieza = (ambId: string) => {
    updateAmbiente(ambId, (a) => ({ ...a, piezas: [...a.piezas, piezaVacia()] }));
  };

  const updatePieza = (ambId: string, piezaId: string, patch: Partial<PiezaPresupuesto>) => {
    updateAmbiente(ambId, (a) => ({
      ...a,
      piezas: a.piezas.map((p) => (p.id === piezaId ? { ...p, ...patch } : p)),
    }));
  };

  const updatePiezaLargoAncho = (
    ambId: string,
    piezaId: string,
    field: 'largo_m' | 'ancho_m',
    raw: string,
  ) => {
    const v = Math.max(0, parseFloat(String(raw).replace(',', '.')) || 0);
    updateAmbiente(ambId, (a) => ({
      ...a,
      piezas: a.piezas.map((p) => {
        if (p.id !== piezaId) return p;
        const next = { ...p, [field]: v } as PiezaPresupuesto;
        const L = Number(next.largo_m) || 0;
        const W = Number(next.ancho_m) || 0;
        if (L > 0 && W > 0) {
          const m2 = Math.round(L * W * 10000) / 10000;
          const dim = formatLargoAnchoMLineaMedida(L, W);
          const nota = notaTrasSincroDimensiones(p.medidas || '', m2);
          return {
            ...next,
            m2,
            medidas: nota ? `${dim} · ${nota}` : dim,
          };
        }
        return next;
      }),
    }));
  };

  const removePieza = (ambId: string, piezaId: string) => {
    updateAmbiente(ambId, (a) => ({
      ...a,
      piezas: a.piezas.filter((p) => p.id !== piezaId),
    }));
  };

  const openExtraForPieza = (ambId: string, piezaId: string) => {
    setExTargetPieza({ ambId, piezaId });
    setExModal(null);
    setExMaestro(null);
    setExNuevoNombre('');
    setExNuevoPrecio('');
    setExCantidad('1');
    setExSelId('');
    setExPrecioLinea('');
  };

  const attachExtraRow = (row: ExtraEnPieza) => {
    if (!exTargetPieza) return;
    const { ambId, piezaId } = exTargetPieza;
    updateAmbiente(ambId, (a) => ({
      ...a,
      piezas: a.piezas.map((p) =>
        p.id === piezaId ? { ...p, extras: [...p.extras, row] } : p,
      ),
    }));
    setExTargetPieza(null);
  };

  const confirmExtraDesdeModal = () => {
    if (!exSelId) {
      toast.error('Seleccione un extra del catálogo o use “Nuevo en catálogo”.');
      return;
    }
    const fromCat = extrasCat.find((x) => x.id === exSelId);
    if (!fromCat) return;
    const qty = Math.max(1, parseInt(exCantidad || '1', 10));
    const precio =
      Math.max(0, parseFloat(String(exPrecioLinea).replace(',', '.')) || 0) || fromCat.precio_base;
    attachExtraRow({
      id: nuevoId(),
      servicio_id: fromCat.id,
      nombre: fromCat.nombre,
      precio,
      cantidad: qty,
    });
  };

  const removeExtra = (ambId: string, piezaId: string, extraId: string) => {
    updateAmbiente(ambId, (a) => ({
      ...a,
      piezas: a.piezas.map((p) =>
        p.id === piezaId ? { ...p, extras: p.extras.filter((e) => e.id !== extraId) } : p,
      ),
    }));
  };

  const onSelectMaterial = (ambId: string, piezaId: string, materialId: string) => {
    const m = materiales.find((x) => x.id === materialId);
    if (!m) return;
    updatePieza(ambId, piezaId, {
      material_id: m.id,
      material_nombre: m.nombre,
      precio_m2: Number(m.precio_m2 || 0),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" /> Ambientes y piezas
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={addAmbiente} className="gap-1">
          <Plus className="w-4 h-4" /> Ambiente
        </Button>
      </div>

      {ambientes.map((amb) => (
        <Card key={amb.id} className="border-slate-200 shadow-sm">
          <CardHeader className="py-3 bg-slate-50/80 border-b">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base flex-1 min-w-[120px]">
                <Input
                  className="font-semibold max-w-xs"
                  value={amb.nombre}
                  onChange={(e) =>
                    setAmbientes((prev) =>
                      prev.map((a) => (a.id === amb.id ? { ...a, nombre: e.target.value } : a)),
                    )
                  }
                />
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600"
                onClick={() => removeAmbiente(amb.id)}
                disabled={ambientes.length <= 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {amb.piezas.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin piezas. Agregue una pieza (material + m²).</p>
            )}
            {amb.piezas.map((pieza) => (
              <div
                key={pieza.id}
                className="rounded-lg border border-slate-200 p-4 space-y-3 bg-white"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Package className="w-4 h-4" /> Pieza / material base
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 h-8"
                    onClick={() => removePieza(amb.id, pieza.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                  <div className="space-y-1 col-span-2 lg:col-span-2">
                    <Label className="text-xs">Material / nombre</Label>
                    <div className="flex gap-2">
                      <Select
                        value={pieza.material_id || '__none__'}
                        onValueChange={(v) => {
                          if (v === '__none__') return;
                          onSelectMaterial(amb.id, pieza.id, v);
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Catálogo…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" disabled>
                            Elegir material
                          </SelectItem>
                          {materiales.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.nombre} — ${Number(m.precio_m2).toLocaleString('es-AR')}/m²
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMatPrecioTarget(
                            materiales.find((x) => x.id === pieza.material_id) || null,
                          );
                          setMatEditPrecio(
                            String(
                              materiales.find((x) => x.id === pieza.material_id)?.precio_m2 ?? '',
                            ),
                          );
                          setMatModal('precio');
                        }}
                        disabled={!pieza.material_id}
                        title="Editar precio en maestro"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Precio / m² (neto)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pieza.precio_m2 || ''}
                      onChange={(e) =>
                        updatePieza(amb.id, pieza.id, {
                          precio_m2: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Largo (m)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={pieza.largo_m || ''}
                      onChange={(e) =>
                        updatePiezaLargoAncho(amb.id, pieza.id, 'largo_m', e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ancho (m)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={pieza.ancho_m || ''}
                      onChange={(e) =>
                        updatePiezaLargoAncho(amb.id, pieza.id, 'ancho_m', e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cant. piezas</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={pieza.cantidad_piezas ?? 1}
                      onChange={(e) =>
                        updatePieza(amb.id, pieza.id, {
                          cantidad_piezas: Math.max(
                            1,
                            Math.min(9999, Math.floor(parseInt(e.target.value, 10) || 1)),
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">m² {pieza.largo_m > 0 && pieza.ancho_m > 0 ? '(auto)' : '(manual)'}</Label>
                    {pieza.largo_m > 0 && pieza.ancho_m > 0 ? (
                      <Input
                        type="number"
                        readOnly
                        className="bg-muted/60"
                        value={metrosCuadradosPieza(pieza) || ''}
                      />
                    ) : (
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        value={pieza.m2 || ''}
                        onChange={(e) =>
                          updatePieza(amb.id, pieza.id, {
                            m2: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                      />
                    )}
                  </div>
                  <div className="space-y-1 col-span-2 lg:col-span-2">
                    <Label className="text-xs">Nota / medidas libres</Label>
                    <Input
                      value={pieza.medidas}
                      onChange={(e) => updatePieza(amb.id, pieza.id, { medidas: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="col-span-2 lg:col-span-7 flex justify-end">
                    <p className="text-sm font-semibold text-slate-800">
                      Subtotal material:{' '}
                      <span className="text-blue-700">
                        $
                        {subtotalMaterialPieza(pieza).toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-xs font-semibold">Extras en esta pieza</Label>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8"
                      onClick={() => openExtraForPieza(amb.id, pieza.id)}
                    >
                      + Extra
                    </Button>
                  </div>
                  {pieza.extras.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin extras</p>
                  )}
                  {pieza.extras.map((ex) => (
                    <div
                      key={ex.id}
                      className="flex flex-wrap justify-between items-center gap-2 text-sm bg-slate-50 rounded px-2 py-1"
                    >
                      <span>
                        {ex.nombre} × {ex.cantidad} @ ${ex.precio.toLocaleString('es-AR')}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-red-600"
                        onClick={() => removeExtra(amb.id, pieza.id, ex.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => addPieza(amb.id)} className="gap-1">
              <Plus className="w-4 h-4" /> Pieza en {amb.nombre}
            </Button>
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setMatModal('nuevo')}>
          + Nuevo material en catálogo
        </Button>
      </div>

      {/* Modal: nuevo material */}
      <Dialog open={matModal === 'nuevo'} onOpenChange={(o) => !o && setMatModal(null)}>
        <PresupuestoModalShell
          title="Nuevo material (catálogo)"
          description="Se crea en el maestro de materiales."
          footer={
            <>
              <Button variant="outline" type="button" onClick={() => setMatModal(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() =>
                  maestros.withLoading(async () => {
                    await maestros.crearMaterial({
                      nombre: matNuevoNombre.trim(),
                      precio_m2: parseFloat(matNuevoPrecio) || 0,
                    });
                    setMatModal(null);
                    setMatNuevoNombre('');
                    setMatNuevoPrecio('');
                    await refreshMateriales();
                  })
                }
                disabled={!matNuevoNombre.trim()}
              >
                Crear
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input value={matNuevoNombre} onChange={(e) => setMatNuevoNombre(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio / m² sin IVA</Label>
              <Input value={matNuevoPrecio} onChange={(e) => setMatNuevoPrecio(e.target.value)} type="number" />
            </div>
          </div>
        </PresupuestoModalShell>
      </Dialog>

      {/* Modal: precio material */}
      <Dialog open={matModal === 'precio'} onOpenChange={(o) => !o && setMatModal(null)}>
        <PresupuestoModalShell
          title="Precio en catálogo"
          description={matPrecioTarget?.nombre}
          footer={
            <>
              <Button variant="outline" type="button" onClick={() => setMatModal(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() =>
                  maestros.withLoading(async () => {
                    if (!matPrecioTarget) return;
                    await maestros.patchPrecioMaterial(
                      matPrecioTarget.id,
                      parseFloat(matEditPrecio) || 0,
                    );
                    setMatModal(null);
                    await refreshMateriales();
                    setAmbientes((prev) =>
                      prev.map((a) => ({
                        ...a,
                        piezas: a.piezas.map((p) =>
                          p.material_id === matPrecioTarget.id
                            ? { ...p, precio_m2: parseFloat(matEditPrecio) || 0 }
                            : p,
                        ),
                      })),
                    );
                  })
                }
              >
                Guardar en maestro
              </Button>
            </>
          }
        >
          <div className="space-y-1">
            <Label className="text-xs">Precio / m² neto</Label>
            <Input value={matEditPrecio} onChange={(e) => setMatEditPrecio(e.target.value)} type="number" />
          </div>
        </PresupuestoModalShell>
      </Dialog>

      {/* Modal: extra en pieza — orden: nombre, precio, cantidad */}
      <Dialog open={!!exTargetPieza} onOpenChange={(o) => !o && setExTargetPieza(null)}>
        <PresupuestoModalShell
          className="sm:max-w-md"
          title="Extra en la pieza"
          description="Catálogo, precio en la línea y cantidad."
          footer={
            <>
              <Button variant="outline" type="button" onClick={() => setExTargetPieza(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={confirmExtraDesdeModal}>
                Agregar a la pieza
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre (catálogo)</Label>
              <Select
                value={exSelId || undefined}
                onValueChange={(id) => {
                  setExSelId(id);
                  const s = extrasCat.find((x) => x.id === id);
                  setExPrecioLinea(s ? String(s.precio_base) : '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar extra…" />
                </SelectTrigger>
                <SelectContent>
                  {extrasCat.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre} — ${Number(s.precio_base).toLocaleString('es-AR', { minimumFractionDigits: 2 })} /{' '}
                      {String(s.unidad || 'unidad').trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio unitario (neto)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={exPrecioLinea}
                onChange={(e) => setExPrecioLinea(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cantidad</Label>
              <Input value={exCantidad} onChange={(e) => setExCantidad(e.target.value)} type="number" min={1} />
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setExModal('nuevo')}>
                Nuevo extra en catálogo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const pick = exSelId ? extrasCat.find((x) => x.id === exSelId) : extrasCat[0];
                  if (pick) {
                    setExMaestro(pick);
                    setExEditPrecio(String(pick.precio_base));
                    setExModal('precio');
                  }
                }}
                disabled={!extrasCat.length}
              >
                Editar precio del maestro
              </Button>
            </div>
          </div>
        </PresupuestoModalShell>
      </Dialog>

      <Dialog open={exModal === 'nuevo'} onOpenChange={(o) => !o && setExModal(null)}>
        <PresupuestoModalShell
          title="Nuevo extra en catálogo"
          footer={
            <>
              <Button variant="outline" type="button" onClick={() => setExModal(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() =>
                  maestros.withLoading(async () => {
                    const nombre = exNuevoNombre.trim();
                    const precio = parseFloat(exNuevoPrecio) || 0;
                    const created = await maestros.crearExtra(nombre, precio);
                    setExModal(null);
                    setExNuevoNombre('');
                    setExNuevoPrecio('');
                    await refreshExtras();
                    if (created?.id && exTargetPieza) {
                      const qty = Math.max(1, parseInt(exCantidad || '1', 10));
                      attachExtraRow({
                        id: nuevoId(),
                        servicio_id: created.id,
                        nombre: created.nombre || nombre,
                        precio: Number(created.precio_base ?? precio),
                        cantidad: qty,
                      });
                    }
                  })
                }
                disabled={!exNuevoNombre.trim()}
              >
                Crear y agregar
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input value={exNuevoNombre} onChange={(e) => setExNuevoNombre(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio neto</Label>
              <Input
                type="number"
                value={exNuevoPrecio}
                onChange={(e) => setExNuevoPrecio(e.target.value)}
              />
            </div>
          </div>
        </PresupuestoModalShell>
      </Dialog>

      <Dialog open={exModal === 'precio'} onOpenChange={(o) => !o && setExModal(null)}>
        <PresupuestoModalShell
          title="Editar precio en catálogo (extra)"
          footer={
            <>
              <Button variant="outline" type="button" onClick={() => setExModal(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!exMaestro}
                onClick={() =>
                  maestros.withLoading(async () => {
                    if (!exMaestro) return;
                    await maestros.patchPrecioExtra(exMaestro.id, parseFloat(exEditPrecio) || 0);
                    setExModal(null);
                    await refreshExtras();
                    setAmbientes((prev) =>
                      prev.map((a) => ({
                        ...a,
                        piezas: a.piezas.map((p) => ({
                          ...p,
                          extras: p.extras.map((e) =>
                            e.servicio_id === exMaestro.id
                              ? { ...e, precio: parseFloat(exEditPrecio) || 0 }
                              : e,
                          ),
                        })),
                      })),
                    );
                  })
                }
              >
                Guardar en maestro
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Extra</Label>
              <Select
                value={exMaestro?.id || ''}
                onValueChange={(id) => {
                  const s = extrasCat.find((x) => x.id === id);
                  setExMaestro(s || null);
                  setExEditPrecio(s ? String(s.precio_base) : '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegir…" />
                </SelectTrigger>
                <SelectContent>
                  {extrasCat.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre} — ${Number(s.precio_base).toLocaleString('es-AR', { minimumFractionDigits: 2 })} /{' '}
                      {String(s.unidad || 'unidad').trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio neto</Label>
              <Input type="number" value={exEditPrecio} onChange={(e) => setExEditPrecio(e.target.value)} />
            </div>
          </div>
        </PresupuestoModalShell>
      </Dialog>
    </div>
  );
}
