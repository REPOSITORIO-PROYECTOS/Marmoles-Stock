import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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

interface ExtrasEditorProps {
  extras: ExtraItem[];
  setExtras: React.Dispatch<React.SetStateAction<ExtraItem[]>>;
  paymentInfo: { tipoCobro: string; conFactura: boolean; descuento: { tipo: 'fijo' | 'porcentaje'; valor: number } };
  setPaymentInfo: (info: { tipoCobro: string; conFactura: boolean; descuento: { tipo: 'fijo' | 'porcentaje'; valor: number } }) => void;
  totalPagar: number;
  showPago?: boolean;
}

export function ExtrasEditor({ extras, setExtras, paymentInfo, setPaymentInfo, totalPagar, showPago = true }: ExtrasEditorProps) {
  const [newItem, setNewItem] = useState<ExtraItem>({
    id: '',
    descripcion: '',
    cantidad: 1,
    precio: 0
  });

  const [availableServices, setAvailableServices] = useState<ServiceItem[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [availableDiscounts, setAvailableDiscounts] = useState<ServiceItem[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>("manual");

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const [extrasRes, descuentosRes] = await Promise.all([
        get<ServiceItem[]>('/api/servicios?categoria=ExtraPresupuesto'),
        get<ServiceItem[]>('/api/servicios?categoria=DescuentoPresupuesto'),
      ]);
      if (extrasRes && Array.isArray(extrasRes)) {
        setAvailableServices(extrasRes);
      }
      if (descuentosRes && Array.isArray(descuentosRes)) {
        setAvailableDiscounts(descuentosRes);
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
      await put(`/api/servicios/${selectedServiceId}`, {
        precio_base: newItem.precio
      });
      toast.success("Precio actualizado en el catálogo");
      loadServices(); // Refresh to ensure sync
    } catch (e) {
      toast.error("Error al actualizar precio");
    }
  };

  const handleCreateNewService = async () => {
    if (!newItem.descripcion) return;
    try {
      const res = await post<ServiceItem>('/api/servicios', {
        nombre: newItem.descripcion,
        precio_base: newItem.precio,
        categoria: "ExtraPresupuesto",
        unidad: "u"
      });
      toast.success("Nuevo extra agregado al catálogo");
      await loadServices();
      // Select the newly created service
      if (res && res.id) {
        setSelectedServiceId(res.id);
      }
    } catch (e) {
      toast.error("Error al crear nuevo extra");
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

  const handleApplyDiscountTemplate = (value: string) => {
    setSelectedDiscountId(value);
    if (value === 'manual') return;
    const selected = availableDiscounts.find(d => d.id === value);
    if (!selected) return;
    const tipo = selected.unidad === '%' ? 'porcentaje' : 'fijo';
    setPaymentInfo({
      ...paymentInfo,
      descuento: {
        tipo,
        valor: Number(selected.precio_base || 0),
      },
    });
  };

  const handleSaveDiscountTemplate = async () => {
    if (!paymentInfo.descuento.valor || paymentInfo.descuento.valor <= 0) return;
    try {
      await post('/api/servicios', {
        nombre: paymentInfo.descuento.tipo === 'porcentaje'
          ? `Descuento ${paymentInfo.descuento.valor}%`
          : `Descuento $${paymentInfo.descuento.valor}`,
        precio_base: Number(paymentInfo.descuento.valor || 0),
        categoria: 'DescuentoPresupuesto',
        unidad: paymentInfo.descuento.tipo === 'porcentaje' ? '%' : '$',
      });
      toast.success('Plantilla de descuento guardada');
      await loadServices();
    } catch {
      toast.error('Error al guardar plantilla de descuento');
    }
  };

  const subtotalExtras = extras.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
  const handleClearAll = () => {
    if (!extras.length) return;
    if (!confirm(`¿Borrar ${extras.length} extras?`)) return;
    setExtras([]);
  };

  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-1 ${showPago ? 'md:grid-cols-2' : ''} gap-6`}>
        {/* COLUMNA 1: AGREGADOS */}
        <Card className="border-cyan-100/80 shadow-sm">
          <CardHeader className="pb-3 border-b bg-linear-to-r from-cyan-50 to-white rounded-t-lg">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="h-4 w-4 text-cyan-600" /> Extras
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

            <div className="bg-slate-50/80 p-3 rounded-md mb-4 border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-xs font-semibold text-slate-700">Catálogo de Extras</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-cyan-600"
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
                <SelectTrigger className="h-9 text-sm bg-white border-slate-300">
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

            <div className="flex gap-2 items-end rounded-md border border-dashed border-cyan-200/80 p-3 bg-cyan-50/30">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Descripción</Label>
                <Input
                  value={newItem.descripcion}
                  onChange={e => setNewItem({ ...newItem, descripcion: e.target.value })}
                  placeholder="Ej: Pegado de bacha..."
                  className="h-9 text-sm bg-white"
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
                  className="h-9 text-sm bg-white"
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
                  className="h-9 text-sm bg-white"
                />
              </div>
              <Button onClick={handleAdd} size="sm" className="h-9 w-9 p-0 shadow-sm">
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
                  className="flex-1 text-xs h-7 border-cyan-200 text-cyan-700 bg-cyan-50"
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

            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2 bg-white">
              {extras.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sin extras agregados todavía</p>
              ) : (
                extras.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-md border border-slate-200 text-sm">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{item.descripcion}</p>
                      <p className="text-xs text-muted-foreground">{item.cantidad} x ${item.precio.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-cyan-700">${(item.cantidad * item.precio).toLocaleString()}</span>
                      <Button variant="ghost" size="sm" data-testid={`delete-extra-${item.id}`} onClick={() => handleRemove(item.id)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {extras.length > 0 && (
              <div className="flex justify-end pt-3 border-t">
                <p className="text-sm font-bold bg-cyan-50 text-cyan-900 px-3 py-1.5 rounded-md border border-cyan-200">Subtotal Extras: <span className="text-cyan-700">${subtotalExtras.toLocaleString()}</span></p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* COLUMNA 2: PAGO */}
        {showPago && (
        <Card className="border-emerald-100/80 shadow-sm">
          <CardHeader className="pb-3 border-b bg-linear-to-r from-emerald-50 to-white rounded-t-lg">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" /> Pago
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
              <Label>Descuento</Label>
              <div className="flex gap-2">
                <Select value={selectedDiscountId} onValueChange={handleApplyDiscountTemplate}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Plantilla de descuento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    {availableDiscounts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nombre} ({d.unidad === '%' ? `${d.precio_base}%` : `$${d.precio_base}`})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handleSaveDiscountTemplate}>
                  <Save className="h-3 w-3 mr-1" /> Guardar
                </Button>
              </div>
              <div className="flex gap-2">
                <Select
                  value={paymentInfo.descuento.tipo}
                  onValueChange={(val) =>
                    setPaymentInfo({
                      ...paymentInfo,
                      descuento: { ...paymentInfo.descuento, tipo: val as 'fijo' | 'porcentaje' }
                    })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fijo">$ Monto Fijo</SelectItem>
                    <SelectItem value="porcentaje">% Porcentaje</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  placeholder={paymentInfo.descuento.tipo === 'fijo' ? 'Ej: 5000' : 'Ej: 10'}
                  value={paymentInfo.descuento.valor === 0 ? '' : paymentInfo.descuento.valor}
                  onChange={(e) => {
                    const val = e.target.value;
                    const num = val === '' ? 0 : parseFloat(val);
                    setPaymentInfo({
                      ...paymentInfo,
                      descuento: { ...paymentInfo.descuento, valor: isNaN(num) ? 0 : num }
                    });
                  }}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-linear-to-r from-cyan-50 to-emerald-50 rounded-lg border border-cyan-200/70">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">Total a pagar</Label>
                <p className="text-xs text-muted-foreground">Total del presupuesto con extras y descuento</p>
              </div>
              <div className="text-lg font-black text-cyan-800">${Number(totalPagar || 0).toLocaleString()}</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Requiere Factura
                </Label>
                <p className="text-xs text-muted-foreground">
                  Se marcará para facturación fiscal A/B
                </p>
              </div>
              <Switch
                checked={paymentInfo.conFactura}
                onCheckedChange={(checked) => setPaymentInfo({ ...paymentInfo, conFactura: checked })}
              />
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
