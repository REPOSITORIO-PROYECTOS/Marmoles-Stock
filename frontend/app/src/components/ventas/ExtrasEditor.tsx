import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Trash2, Plus, DollarSign, Receipt, Save, RefreshCw } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { get, post, put, del } from '../../api';
import { toast } from 'sonner';

interface ExtraItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precio: number;
}

interface ServiceItem {
  id: string;
  nombre: string;
  precio_base: number;
  unidad: string;
  categoria?: string;
}

type PaymentInfoShape = {
  tipoCobro: string;
  conFactura: boolean;
  /** Alineado con `usePresupuestoSimple` (siempre presente, puede ser null). */
  plazoPagoCatalogoId: string | null;
  condicionesPagoTexto: string;
  descuento: { catalogoId: string | null; tipo: 'fijo' | 'porcentaje'; valor: number };
};

interface CatalogoDescRow {
  id: string;
  nombre: string;
  tipo: string;
  valor: number;
  unidad?: string | null;
}

interface ExtrasEditorProps {
  extras: ExtraItem[];
  setExtras: React.Dispatch<React.SetStateAction<ExtraItem[]>>;
  paymentInfo: PaymentInfoShape;
  /** Mismo contrato que `useState` en el hook (objeto o función actualizadora). */
  setPaymentInfo: React.Dispatch<React.SetStateAction<PaymentInfoShape>>;
  totalPagar: number;
  /** Solo condiciones de pago y descuentos (extras van en el árbol de ambientes). */
  paymentOnly?: boolean;
  /** Constructor: plazo desde maestro, sin factura ni bloque “tipo cobro” libre */
  condicionesConstructor?: boolean;
  plazosPago?: { id: string; nombre: string; codigo: string }[];
  /** Si viene definido (p. ej. desde Constructor), reemplaza la carga interna de `/api/descuentos-catalogo`. */
  catalogoDescuentosDesdePadre?: CatalogoDescRow[] | null;
}

export function ExtrasEditor({
  extras,
  setExtras,
  paymentInfo,
  setPaymentInfo,
  totalPagar,
  paymentOnly = false,
  condicionesConstructor = false,
  plazosPago = [],
  catalogoDescuentosDesdePadre = null,
}: ExtrasEditorProps) {
  const [newItem, setNewItem] = useState<ExtraItem>({
    id: '',
    descripcion: '',
    cantidad: 1,
    precio: 0
  });

  const [availableServices, setAvailableServices] = useState<ServiceItem[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [catalogoDescuentos, setCatalogoDescuentos] = useState<CatalogoDescRow[]>([]);

  useEffect(() => {
    if (catalogoDescuentosDesdePadre != null) {
      setCatalogoDescuentos(
        Array.isArray(catalogoDescuentosDesdePadre) ? catalogoDescuentosDesdePadre : [],
      );
    }
  }, [catalogoDescuentosDesdePadre]);

  useEffect(() => {
    if (catalogoDescuentosDesdePadre != null) return;
    if (!paymentOnly) loadServices();
    else loadDescuentosOnly();
  }, [paymentOnly, catalogoDescuentosDesdePadre]);

  const loadDescuentosOnly = async () => {
    try {
      const descuentosRes = await get<CatalogoDescRow[]>('/api/descuentos-catalogo');
      if (descuentosRes && Array.isArray(descuentosRes)) setCatalogoDescuentos(descuentosRes);
    } catch (e) {
      console.error(e);
    }
  };

  const loadServices = async () => {
    try {
      const [extrasRes, descuentosRes] = await Promise.all([
        get<ServiceItem[]>('/api/presupuestos/maestros/extras?solo_extra_pieza=true').catch(() =>
          get<ServiceItem[]>('/api/servicios'),
        ),
        get<CatalogoDescRow[]>('/api/descuentos-catalogo'),
      ]);
      if (extrasRes && Array.isArray(extrasRes)) {
        setAvailableServices(extrasRes);
      }
      if (descuentosRes && Array.isArray(descuentosRes)) {
        setCatalogoDescuentos(descuentosRes);
      }
    } catch (error) {
      console.error("Error loading services", error);
    }
  };

  const handleAdd = () => {
    if (!newItem.descripcion || newItem.precio < 0 || newItem.cantidad <= 0) return;
    setExtras([...extras, { ...newItem, id: Date.now().toString() }]);
    setNewItem({ id: '', descripcion: '', cantidad: 1, precio: 0 });
    setSelectedServiceId("");
  };

  const handleRemove = (id: string | number) => {
    setExtras(prev => prev.filter(e => String(e.id) !== String(id)));
  };

  const handleUpdateCatalogPrice = async () => {
    if (!selectedServiceId) return;
    try {
      const { patch } = await import('../../api');
      await patch(`/api/presupuestos/maestros/extras/${selectedServiceId}/precio`, {
        precio_base: newItem.precio,
      });
      toast.success("Precio actualizado en el catálogo");
      loadServices();
    } catch (e) {
      try {
        await put(`/api/servicios/${selectedServiceId}`, { precio_base: newItem.precio });
        toast.success("Precio actualizado en el catálogo");
        loadServices();
      } catch {
        toast.error("Error al actualizar precio");
      }
    }
  };

  const handleCreateNewService = async () => {
    if (!newItem.descripcion) return;
    try {
      const res = await post<ServiceItem>('/api/presupuestos/maestros/extras', {
        nombre: newItem.descripcion,
        precio_base: newItem.precio,
        unidad: "u"
      });
      toast.success("Nuevo extra agregado al catálogo");
      await loadServices();
      if (res && res.id) {
        setSelectedServiceId(res.id);
      }
    } catch (e) {
      try {
        const res = await post<ServiceItem>('/api/servicios', {
          nombre: newItem.descripcion,
          precio_base: newItem.precio,
          categoria: "ExtraPresupuesto",
          unidad: "u"
        });
        toast.success("Nuevo extra agregado al catálogo");
        await loadServices();
        if (res && res.id) setSelectedServiceId(res.id);
      } catch {
        toast.error("Error al crear nuevo extra");
      }
    }
  };

  const handleDeleteSelectedExtra = async () => {
    if (!selectedServiceId) return;
    if (!confirm('¿Eliminar este extra del catálogo?')) return;
    try {
      await del(`/api/servicios/${selectedServiceId}`);
      toast.success('Extra eliminado del catálogo');
      setSelectedServiceId('');
      await loadServices();
    } catch {
      toast.error('Error al eliminar extra del catálogo (requiere admin)');
    }
  };

  const handleSelectDescuentoCatalogo = (value: string) => {
    if (value === '__ninguno__') {
      setPaymentInfo({
        ...paymentInfo,
        descuento: { catalogoId: null, tipo: 'fijo', valor: 0 },
      });
      return;
    }
    const selected = catalogoDescuentos.find(d => d.id === value);
    if (!selected) return;
    const tipo = selected.tipo === 'porcentaje' ? 'porcentaje' : 'fijo';
    setPaymentInfo({
      ...paymentInfo,
      descuento: {
        catalogoId: selected.id,
        tipo,
        valor: Number(selected.valor || 0),
      },
    });
  };

  const handlePlazoCatalogo = (value: string) => {
    const pl = plazosPago.find((x) => x.id === value);
    if (!pl) return;
    setPaymentInfo({
      ...paymentInfo,
      plazoPagoCatalogoId: pl.id,
      tipoCobro: pl.codigo,
    });
  };

  const subtotalExtras = extras.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
  const handleClearAll = () => {
    if (!extras.length) return;
    if (!confirm(`¿Borrar ${extras.length} extras?`)) return;
    setExtras([]);
  };

  return (
    <div className="space-y-6">
      <div
        className={`grid grid-cols-1 gap-6 ${paymentOnly ? '' : 'md:grid-cols-2'}`}
      >
        {/* COLUMNA 1: AGREGADOS */}
        {!paymentOnly && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" /> Extras
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              {extras.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7"
                  onClick={handleClearAll}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Borrar todos
                </Button>
              )}
            </div>

            <div className="bg-slate-50 p-3 rounded-md mb-4 border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-xs font-semibold text-slate-700">Catálogo de Extras</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-blue-600"
                  onClick={loadServices}
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Actualizar
                </Button>
              </div>

              <Select value={selectedServiceId} onValueChange={(val) => {
                setSelectedServiceId(val);
                const s = availableServices.find(x => x.id === val);
                if (s) {
                  setNewItem({ ...newItem, descripcion: s.nombre, precio: s.precio_base });
                }
              }}>
                <SelectTrigger className="h-8 text-sm bg-white">
                  <SelectValue placeholder="Seleccionar del catálogo..." />
                </SelectTrigger>
                <SelectContent>
                  {availableServices.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre} - ${s.precio_base}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Descripción</Label>
                <Input
                  value={newItem.descripcion}
                  onChange={e => setNewItem({ ...newItem, descripcion: e.target.value })}
                  placeholder="Ej: Pegado de bacha..."
                  className="h-8 text-sm"
                />
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-xs">Cant.</Label>
                <Input
                  type="number"
                  min="1"
                  value={newItem.cantidad === 0 ? '' : newItem.cantidad}
                  onChange={e => {
                    const v = e.target.value;
                    const num = v === '' ? 0 : parseFloat(v);
                    setNewItem({ ...newItem, cantidad: isNaN(num) ? 0 : num });
                  }}
                  className="h-8 text-sm"
                />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">Precio Unit.</Label>
                <Input
                  type="number"
                  min="0"
                  value={newItem.precio === 0 ? '' : String(newItem.precio)}
                  onChange={e => {
                    const v = e.target.value;
                    const num = v === '' ? 0 : parseFloat(v);
                    setNewItem({ ...newItem, precio: isNaN(num) ? 0 : num });
                  }}
                  className="h-8 text-sm"
                />
              </div>
              <Button onClick={handleAdd} size="sm" className="h-8 w-8 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Buttons for Catalog Management */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-7 border-dashed"
                onClick={handleCreateNewService}
                disabled={!newItem.descripcion}
              >
                <Plus className="h-3 w-3 mr-1" /> Guardar Nuevo en Catálogo
              </Button>
              {selectedServiceId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-7 border-blue-200 text-blue-700 bg-blue-50"
                  onClick={handleUpdateCatalogPrice}
                >
                  <Save className="h-3 w-3 mr-1" /> Actualizar Precio Catálogo
                </Button>
              )}
              {selectedServiceId && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs h-7"
                  onClick={handleDeleteSelectedExtra}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Eliminar Catálogo
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-1">
              {extras.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sin agregados</p>
              ) : (
                extras.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border text-sm">
                    <div className="flex-1">
                      <p className="font-medium">{item.descripcion}</p>
                      <p className="text-xs text-muted-foreground">{item.cantidad} x ${item.precio.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold">${(item.cantidad * item.precio).toLocaleString()}</span>
                      <Button variant="ghost" size="sm" data-testid={`delete-extra-${item.id}`} onClick={() => handleRemove(item.id)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {extras.length > 0 && (
              <div className="flex justify-end pt-2 border-t">
                <p className="text-sm font-bold">Subtotal Extras: <span className="text-blue-600">${subtotalExtras.toLocaleString()}</span></p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* COLUMNA 2: PAGO */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />{' '}
              {paymentOnly && condicionesConstructor ? 'Condiciones' : 'Pago'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {paymentOnly && condicionesConstructor ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Plazo de pago (catálogo administrador)</Label>
                  <Select
                    value={
                      paymentInfo.plazoPagoCatalogoId ||
                      plazosPago.find((p) => p.codigo === paymentInfo.tipoCobro)?.id ||
                      plazosPago[0]?.id ||
                      ''
                    }
                    onValueChange={handlePlazoCatalogo}
                    disabled={!plazosPago.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={plazosPago.length ? 'Seleccionar plazo' : 'Sin plazos en catálogo'} />
                    </SelectTrigger>
                    <SelectContent>
                      {plazosPago.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condiciones-pago-texto">Condiciones de pago (texto en presupuesto PDF)</Label>
                  <Textarea
                    id="condiciones-pago-texto"
                    value={paymentInfo.condicionesPagoTexto}
                    onChange={(e) =>
                      setPaymentInfo({ ...paymentInfo, condicionesPagoTexto: e.target.value })
                    }
                    placeholder="Ej.: 50% al aceptar, 50% contra entrega. Si queda vacío, se usa el nombre del plazo del catálogo."
                    rows={4}
                    className="text-sm min-h-[88px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este texto es el que verá el cliente en el PDF bajo «Forma de pago».
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Descuento (catálogo administrador)</Label>
                  <Select
                    value={paymentInfo.descuento.catalogoId || '__ninguno__'}
                    onValueChange={handleSelectDescuentoCatalogo}
                  >
                    <SelectTrigger className="w-full" data-testid="descuento-catalogo-select">
                      <SelectValue placeholder="Sin descuento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ninguno__">Sin descuento</SelectItem>
                      {catalogoDescuentos.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nombre} ({d.tipo === 'porcentaje' ? `${d.valor}%` : `$${d.valor}`})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {paymentInfo.descuento.catalogoId && paymentInfo.descuento.valor > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Aplicado:{' '}
                      {paymentInfo.descuento.tipo === 'porcentaje'
                        ? `${paymentInfo.descuento.valor}%`
                        : `$${paymentInfo.descuento.valor}`}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <Label>Tipo de Cobro</Label>
                  <Select
                    value={paymentInfo.tipoCobro}
                    onValueChange={(val) => setPaymentInfo({ ...paymentInfo, tipoCobro: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="pos">POS / Tarjeta</SelectItem>
                      <SelectItem value="cta_cte">Cuenta Corriente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Descuento (catálogo)</Label>
                  <Select
                    value={paymentInfo.descuento.catalogoId || '__ninguno__'}
                    onValueChange={handleSelectDescuentoCatalogo}
                  >
                    <SelectTrigger className="w-full" data-testid="descuento-catalogo-select">
                      <SelectValue placeholder="Sin descuento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ninguno__">Sin descuento</SelectItem>
                      {catalogoDescuentos.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nombre} ({d.tipo === 'porcentaje' ? `${d.valor}%` : `$${d.valor}`})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {paymentInfo.descuento.catalogoId && paymentInfo.descuento.valor > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Aplicado:{' '}
                      {paymentInfo.descuento.tipo === 'porcentaje'
                        ? `${paymentInfo.descuento.valor}%`
                        : `$${paymentInfo.descuento.valor}`}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-base flex items-center gap-2">Total a pagar</Label>
                    <p className="text-xs text-muted-foreground">Total del presupuesto con extras y descuento</p>
                  </div>
                  <div className="text-lg font-black text-blue-700">${Number(totalPagar || 0).toLocaleString()}</div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-base flex items-center gap-2">
                      <Receipt className="h-4 w-4" /> Requiere Factura
                    </Label>
                    <p className="text-xs text-muted-foreground">Se marcará para facturación fiscal A/B</p>
                  </div>
                  <Switch
                    checked={paymentInfo.conFactura}
                    onCheckedChange={(checked) => setPaymentInfo({ ...paymentInfo, conFactura: checked })}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
