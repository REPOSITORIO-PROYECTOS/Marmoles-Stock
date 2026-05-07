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
import { Trash2, Pencil, ShoppingBag } from 'lucide-react';
import type { usePresupuestoMaestros } from '../../../hook/usePresupuestoMaestros';
import type { ProductoAdicionalMaestro } from '../../../hook/usePresupuestoMaestros';
import { nuevoId, type ProductoAdicionalLinea } from '../../../types/presupuestoConstructor';

type Maestros = ReturnType<typeof usePresupuestoMaestros>;

type Props = {
  productos: ProductoAdicionalLinea[];
  setProductos: React.Dispatch<React.SetStateAction<ProductoAdicionalLinea[]>>;
  catalogo: ProductoAdicionalMaestro[];
  refreshCatalogo: () => Promise<void>;
  maestros: Maestros;
};

export function ConstructorProductosAdicionales({
  productos,
  setProductos,
  catalogo,
  refreshCatalogo,
  maestros,
}: Props) {
  const [qty, setQty] = useState('1');
  const [precioModal, setPrecioModal] = useState<ProductoAdicionalMaestro | null>(null);
  const [precioEdit, setPrecioEdit] = useState('');
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [nuevoCantidad, setNuevoCantidad] = useState('1');

  const addFromCatalog = (p: ProductoAdicionalMaestro) => {
    const q = Math.max(1, parseInt(qty || '1', 10));
    setProductos((prev) => [
      ...prev,
      {
        id: nuevoId(),
        producto_id: p.id,
        nombre: p.nombre,
        precio: p.precio_venta,
        cantidad: q,
      },
    ]);
    setQty('1');
  };

  return (
    <Card className="border-amber-100 shadow-sm">
      <CardHeader className="py-3 bg-amber-50/50 border-b">
        <CardTitle className="text-lg flex items-center gap-2 text-amber-950">
          <ShoppingBag className="w-5 h-5" /> Productos adicionales
        </CardTitle>
        <p className="text-xs text-muted-foreground font-normal">
          Separados del árbol ambiente / pieza. Precios netos sin IVA.
        </p>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px] space-y-1">
            <Label className="text-xs">Agregar desde catálogo</Label>
            <Select
              onValueChange={(id) => {
                const p = catalogo.find((x) => x.id === id);
                if (p) addFromCatalog(p);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nombre del producto…" />
              </SelectTrigger>
              <SelectContent>
                {catalogo.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} — ${p.precio_venta.toLocaleString('es-AR')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cantidad (rápida)</Label>
            <Input className="w-20" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => setNuevoOpen(true)}>
            Nuevo en catálogo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10"
            onClick={() => {
              const p = catalogo[0];
              if (p) {
                setPrecioModal(p);
                setPrecioEdit(String(p.precio_venta));
              }
            }}
            disabled={!catalogo.length}
          >
            <Pencil className="w-4 h-4 mr-1" /> Editar precio catálogo
          </Button>
        </div>

        {productos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin productos adicionales</p>
        ) : (
          <ul className="space-y-2">
            {productos.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-end gap-2 text-sm border rounded-md px-3 py-2 bg-white"
              >
                <div className="flex-1 min-w-[140px] space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Nombre</Label>
                  <p className="font-medium leading-tight">{row.nombre}</p>
                </div>
                <div className="space-y-1 w-24">
                  <Label className="text-[10px] text-muted-foreground">Precio</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-8"
                    value={row.precio}
                    onChange={(e) => {
                      const v = Math.max(0, parseFloat(e.target.value) || 0);
                      setProductos((prev) =>
                        prev.map((x) => (x.id === row.id ? { ...x, precio: v } : x)),
                      );
                    }}
                  />
                </div>
                <div className="space-y-1 w-20">
                  <Label className="text-[10px] text-muted-foreground">Cant.</Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-8"
                    value={row.cantidad}
                    onChange={(e) => {
                      const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                      setProductos((prev) =>
                        prev.map((x) => (x.id === row.id ? { ...x, cantidad: v } : x)),
                      );
                    }}
                  />
                </div>
                <div className="flex flex-col items-end gap-1 ml-auto">
                  <span className="text-xs text-muted-foreground">
                    Subt. ${(row.precio * row.cantidad).toLocaleString('es-AR')}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 h-8"
                    onClick={() => setProductos((prev) => prev.filter((x) => x.id !== row.id))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={nuevoOpen} onOpenChange={setNuevoOpen}>
        <PresupuestoModalShell
          title="Nuevo producto adicional"
          description="Orden: nombre, precio, cantidad. Se crea en el catálogo y se agrega al presupuesto."
          footer={
            <>
              <Button variant="outline" type="button" onClick={() => setNuevoOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() =>
                  maestros.withLoading(async () => {
                    const nom = nuevoNombre.trim();
                    const pre = parseFloat(nuevoPrecio) || 0;
                    const q = Math.max(1, parseInt(nuevoCantidad || '1', 10));
                    const r = await maestros.crearProductoAdicional(nom, pre);
                    setNuevoOpen(false);
                    setNuevoNombre('');
                    setNuevoPrecio('');
                    setNuevoCantidad('1');
                    await refreshCatalogo();
                    if (r?.id) {
                      setProductos((prev) => [
                        ...prev,
                        {
                          id: nuevoId(),
                          producto_id: r.id,
                          nombre: nom,
                          precio: pre,
                          cantidad: q,
                        },
                      ]);
                    }
                  })
                }
                disabled={!nuevoNombre.trim()}
              >
                Crear y agregar
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio venta neto</Label>
              <Input
                type="number"
                value={nuevoPrecio}
                onChange={(e) => setNuevoPrecio(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={nuevoCantidad}
                onChange={(e) => setNuevoCantidad(e.target.value)}
              />
            </div>
          </div>
        </PresupuestoModalShell>
      </Dialog>

      <Dialog open={!!precioModal} onOpenChange={(o) => !o && setPrecioModal(null)}>
        <PresupuestoModalShell
          title="Precio en catálogo"
          description="Actualiza el maestro de productos adicionales."
          footer={
            <>
              <Button variant="outline" type="button" onClick={() => setPrecioModal(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!precioModal}
                onClick={() =>
                  maestros.withLoading(async () => {
                    if (!precioModal) return;
                    await maestros.patchPrecioProducto(precioModal.id, parseFloat(precioEdit) || 0);
                    setPrecioModal(null);
                    await refreshCatalogo();
                    setProductos((prev) =>
                      prev.map((x) =>
                        x.producto_id === precioModal.id
                          ? { ...x, precio: parseFloat(precioEdit) || 0 }
                          : x,
                      ),
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
              <Label className="text-xs">Producto</Label>
              <Select
                value={precioModal?.id || ''}
                onValueChange={(id) => {
                  const p = catalogo.find((x) => x.id === id);
                  setPrecioModal(p || null);
                  setPrecioEdit(p ? String(p.precio_venta) : '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Producto" />
                </SelectTrigger>
                <SelectContent>
                  {catalogo.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio neto</Label>
              <Input type="number" value={precioEdit} onChange={(e) => setPrecioEdit(e.target.value)} />
            </div>
          </div>
        </PresupuestoModalShell>
      </Dialog>
    </Card>
  );
}
