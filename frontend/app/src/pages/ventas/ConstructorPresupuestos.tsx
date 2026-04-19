import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Switch } from "../../components/ui/switch";
import { Printer, RefreshCw, Plus, Trash2, Search, CheckCircle } from "lucide-react";

import { useLocation } from 'react-router-dom';
import { get, post } from '../../api';
import { usePresupuestoSimple } from "../../hook/usePresupuestoSimple";
import { imprimirPresupuestoArgentino } from "../../utils/presupuestoExporter";
import { LoteSelector } from "../../components/ventas/LoteSelector";
import { ClienteForm } from "../../components/ventas/ClienteForm";
import { ExtrasEditor } from "../../components/ventas/ExtrasEditor";

interface PiezaManual {
  id: string;
  descripcion: string;
  ancho_cm: number | '';
  largo_cm: number | '';
  cantidad: number;
}

const nuevaPieza = (): PiezaManual => ({
  id: `${Date.now()}-${Math.random()}`,
  descripcion: '',
  ancho_cm: '',
  largo_cm: '',
  cantidad: 1,
});

export function ConstructorPresupuestos() {
  const engine = usePresupuestoSimple();
  const location = useLocation();

  const [piezas, setPiezas] = useState<PiezaManual[]>([nuevaPieza()]);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockInfo, setStockInfo] = useState<any[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [insumoTipo, setInsumoTipo] = useState<'articulo' | 'accesorio'>('articulo');
  const [insumoSeleccionadoId, setInsumoSeleccionadoId] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.get('presupuestoId')) {
      engine.limpiarTodo();
      setPiezas([nuevaPieza()]);
    }
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cálculos ────────────────────────────────────────────────────────────

  const calcAreaPieza = (p: PiezaManual) => {
    const a = Number(p.ancho_cm) || 0;
    const l = Number(p.largo_cm) || 0;
    const q = Math.max(1, p.cantidad);
    return (a * l * q) / 10000;
  };

  const cmToM = (value: number | '') => {
    const n = Number(value);
    return Number.isFinite(n) ? (n / 100) : 0;
  };

  const mToCm = (value: string) => {
    const n = Number(value);
    return Number.isFinite(n) ? (n * 100) : 0;
  };

  const formatDimensionesM = (anchoCm: number, largoCm: number, qty: number) => {
    const largoM = (largoCm / 100).toFixed(2);
    const anchoM = (anchoCm / 100).toFixed(2);
    return `${largoM}m × ${anchoM}m ×${qty}`;
  };

  const sanitizeFilePart = (value: string) => {
    return (value || 'Cliente')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_\-]/g, '');
  };

  const totalAreaActual = piezas.reduce((sum, p) => sum + calcAreaPieza(p), 0);

  const subtotalMateriales = engine.items.reduce((acc: number, item: any) => {
    const materialId = String(item?.seleccion?.materialId || '');
    if (materialId.startsWith('prod:') || materialId.startsWith('acc:')) return acc;
    const qty = Number(item?.planoData?.areaUtilizada || 0);
    return acc + (Number(item?.seleccion?.precioBase || 0) * qty);
  }, 0);

  const subtotalArticulos = engine.items.reduce((acc: number, item: any) => {
    const materialId = String(item?.seleccion?.materialId || '');
    if (!(materialId.startsWith('prod:') || materialId.startsWith('acc:'))) return acc;
    const qty = Number(item?.seleccion?.cantidad || item?.planoData?.areaUtilizada || 0);
    return acc + (Number(item?.seleccion?.precioBase || 0) * qty);
  }, 0);

  const subtotalExtras = engine.extras.reduce((acc: number, extra: any) => {
    return acc + (Number(extra?.precio || 0) * Number(extra?.cantidad || 0));
  }, 0);

  const bruto = subtotalMateriales + subtotalArticulos + subtotalExtras;

  const descuentoVal = Number(engine.paymentInfo.descuento?.valor || 0);
  const descuentoMonto = engine.paymentInfo.descuento?.tipo === 'porcentaje'
    ? bruto * (descuentoVal / 100)
    : descuentoVal;
  const subtotalNeto = Math.max(0, bruto - descuentoMonto);
  const ivaMonto = subtotalNeto * 0.21;
  const totalFinal = subtotalNeto + ivaMonto;

  const articulos = (engine.articulosList || []).filter((a: any) => {
    const cat = String(a?.categoria || '').toLowerCase();
    return !cat.includes('accesor');
  });
  const accesorios = (engine.articulosList || []).filter((a: any) => {
    const cat = String(a?.categoria || '').toLowerCase();
    return cat.includes('accesor');
  });

  // ── Handlers ────────────────────────────────────────────────────────────

  const handlePiezaChange = (id: string, field: keyof PiezaManual, value: string | number) => {
    setPiezas(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleEliminarPieza = (id: string) => {
    setPiezas(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev);
  };

  const handleAgregarItem = () => {
    const piezasValidas = piezas.filter(p => Number(p.ancho_cm) > 0 && Number(p.largo_cm) > 0);
    if (piezasValidas.length === 0) {
      alert("Ingrese al menos una pieza con ancho y largo válidos");
      return;
    }
    const piezasPayload = piezasValidas.map(p => ({
      w_cm: Number(p.ancho_cm),
      h_cm: Number(p.largo_cm),
      qty: Math.max(1, p.cantidad),
      label: p.descripcion || undefined,
    }));
    const ok = engine.agregarItemManual(totalAreaActual, piezasPayload);
    if (ok) {
      setPiezas([nuevaPieza()]);
    }
  };

  const handleVerificarStock = async () => {
    if (!engine.seleccion.materialId
      || engine.seleccion.materialId === '__manual__'
      || engine.seleccion.materialId === '__sin_material__') {
      alert("Seleccione un material del inventario para verificar stock");
      return;
    }
    setLoadingStock(true);
    setStockModalOpen(true);
    try {
      const data = await get<any[]>(`/api/inventario/stock-detallado?material_id=${engine.seleccion.materialId}`);
      setStockInfo(Array.isArray(data) ? data : []);
    } catch {
      setStockInfo([]);
    } finally {
      setLoadingStock(false);
    }
  };

  const handleGenerarMaterialesEjemplo = async () => {
    try {
      const ejemplos = [
        { nombre: 'Superficie Blanca 20mm', precio_m2: 58000, espesor_mm: 20, color: 'Blanco', ancho_m: 1.6, largo_m: 3.2, stock_actual: 18 },
        { nombre: 'Superficie Gris 20mm', precio_m2: 62000, espesor_mm: 20, color: 'Gris', ancho_m: 1.6, largo_m: 3.2, stock_actual: 14 },
      ];
      for (const material of ejemplos) {
        await post('/api/materiales', material);
      }
      window.location.reload();
    } catch {
      alert('No se pudieron crear los materiales de ejemplo.');
    }
  };

  const handleAgregarInsumo = () => {
    const fuente = insumoTipo === 'accesorio' ? accesorios : articulos;
    const elegido = fuente.find((i: any) => i.id === insumoSeleccionadoId);
    if (!elegido) {
      alert('Seleccione un insumo para agregar');
      return;
    }
    if (insumoTipo === 'accesorio') {
      engine.seleccionarAccesorio(elegido);
    } else {
      engine.seleccionarArticulo(elegido);
    }
    engine.agregarItem();
    setInsumoSeleccionadoId('');
  };

  const handleImprimir = async () => {
    if (!engine.cliente && !engine.formCliente.nombre) {
      alert("Seleccione o ingrese un cliente");
      return;
    }
    if (engine.items.length === 0) {
      alert("Agregue al menos un ítem usando el botón 'Agregar Ítem'");
      return;
    }

    const success = await engine.guardarPresupuestoYLead([]);
    if (!success) return;

    const datosCliente = engine.clientesList.find((c: any) => c.id === engine.cliente) ||
      { nombre: engine.formCliente.nombre || 'Consumidor Final', cuit: '', direccion: '', telefono: '', coordenadas: '' };

    const linkUbicacion = datosCliente.coordenadas
      ? `https://www.google.com/maps?q=${datosCliente.coordenadas.replace(/\s/g, '')}`
      : undefined;

    const materialItems = engine.items.map((item: any) => {
      const piezasList: any[] = item.planoData?.primitives?.[0]?.piezas || [];
      const medidasStr = piezasList.length > 0
        ? piezasList.map((p: any, i: number) =>
          `${p.label || `Pieza ${i + 1}`}: ${formatDimensionesM(Number(p.w_cm || p.w || 0), Number(p.h_cm || p.h || 0), Number(p.qty || 1))}`
        ).join(' | ')
        : `${Number(item.planoData.areaUtilizada).toFixed(3)} m²`;
      return {
        detalle: item.seleccion.materialNombre + (item.seleccion.loteCodigo ? ` (Lote: ${item.seleccion.loteCodigo})` : ''),
        medidas: medidasStr,
        cantidad: parseFloat(Number(item.planoData.areaUtilizada).toFixed(3)),
        precioUnitario: item.seleccion.precioBase,
        total: item.seleccion.precioBase * item.planoData.areaUtilizada,
      };
    });

    const pdfItems = [...materialItems];

    const piezasDetalle = engine.items.flatMap((item: any) => {
      const piezasList: any[] = item.planoData?.primitives?.[0]?.piezas || [];
      return piezasList.map((p: any, i: number) => ({
        w: p.w_cm || p.w || 0,
        h: p.h_cm || p.h || 0,
        agujeros: 0,
        label: `${p.label || `Pieza ${i + 1}`}: ${formatDimensionesM(Number(p.w_cm || p.w || 0), Number(p.h_cm || p.h || 0), Number(p.qty || 1))} — ${item.seleccion.materialNombre}`,
      }));
    });

    const correlativo = Number(engine.ultimoPresupuesto?.correlativo_global || 0);
    const correlativoText = correlativo > 0 ? String(correlativo).padStart(6, '0') : '000000';
    const nombreClienteArchivo = sanitizeFilePart(datosCliente.nombre || 'Cliente');
    const nombreArchivo = `${nombreClienteArchivo} - ${correlativoText}.pdf`;

    const subtotalNeto = Number(engine.ultimoPresupuesto?.subtotal_neto ?? totalFinal);
    const ivaMonto = Number(engine.ultimoPresupuesto?.iva_monto ?? 0);
    const totalFiscal = Number(engine.ultimoPresupuesto?.total_final ?? totalFinal);
    const docId = engine.ultimoPresupuesto?.id
      ? `P-${String(engine.ultimoPresupuesto.id).slice(-6)}`
      : `P-${Date.now().toString().slice(-6)}`;

    imprimirPresupuestoArgentino({
      id: docId,
      correlativoGlobal: correlativo || undefined,
      nombreArchivo,
      fecha: new Date().toLocaleDateString('es-AR'),
      cliente: {
        nombre: datosCliente.nombre,
        dni_cuit: datosCliente.cuit || '',
        direccion: datosCliente.direccion || '',
        telefono: '',
        condicionIva: 'Consumidor Final',
      },
      linkUbicacion,
      empresa: {
        nombre: "Mundo di Marmi",
        cuit: "",
        direccion: "",
      },
      items: pdfItems,
      total: totalFiscal,
      subtotalMateriales,
      subtotalExtras,
      subtotalNeto,
      ivaMonto,
      totalFinal: totalFiscal,
      observaciones: "Precios sujetos a variación del dólar.",
      piezasDetalle,
    });
  };

  const hasCliente = Boolean(engine.cliente || engine.formCliente.nombre);
  const hasMaterial = Boolean(engine.seleccion.materialId);
  const totalStockDisponible = stockInfo.reduce((s: number, l: any) => s + Number(l.stock_actual || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            MDM <span className="text-cyan-600">COTIZADOR</span>
          </h1>
          <p className="text-gray-500 text-sm">Presupuesto manual por piezas</p>
        </div>
        <Button
          variant="outline"
          onClick={() => { engine.limpiarTodo(); setPiezas([nuevaPieza()]); }}
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Nuevo Presupuesto
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-6 items-start">
        <div className="space-y-6">
      {/* CLIENTE */}
      <Card className="shadow-md border-cyan-100">
        <CardHeader className="border-b bg-gray-50/50">
          <CardTitle className="text-lg text-cyan-900">Cliente</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <ClienteForm
            clientes={engine.clientesList}
            clienteId={engine.cliente}
            formCliente={engine.formCliente}
            editingExisting={false}
            onSelect={(id) => {
              engine.setCliente(id);
              engine.resetMaterialAndPlan();
              engine.limpiarItems();
              setPiezas([nuevaPieza()]);
            }}
            onFormChange={engine.setFormCliente}
            onGuardarNuevo={() => engine.registrarNuevoCliente()}
            onEditarExistente={() => { }}
          />
        </CardContent>
      </Card>

      {/* MATERIAL + PIEZAS */}
      {hasCliente && (
        <Card className="shadow-md border-cyan-100">
          <CardHeader className="border-b bg-gray-50/50">
            <CardTitle className="text-lg text-cyan-900">Material y Piezas</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">

            <div className="max-w-xl">
              <LoteSelector
                materiales={engine.materialesList}
                lotes={engine.lotesDisponibles}
                selectedMaterialId={engine.seleccion.materialId}
                selectedLoteId={engine.seleccion.loteId}
                precioBase={engine.seleccion.precioBase}
                precioTipo={engine.precioTipo}
                onMaterialChange={engine.seleccionarMaterial}
                onLoteChange={engine.seleccionarLote}
                onPrecioTipoChange={engine.setPrecioTipo}
                onProductoSelect={engine.seleccionarProducto}
              />
              {engine.materialesList.length === 0 && (
                <div className="mt-3">
                  <Button type="button" variant="outline" onClick={handleGenerarMaterialesEjemplo}>
                    Crear materiales de ejemplo
                  </Button>
                </div>
              )}
            </div>

            {hasMaterial && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-semibold text-gray-800">Piezas a cotizar</h3>
                  <span className="text-sm text-gray-500">
                    Total:{' '}
                    <strong className="text-cyan-700">{totalAreaActual.toFixed(3)} m²</strong>
                    {engine.seleccion.precioBase > 0 && (
                      <span className="ml-2">
                        × ${engine.seleccion.precioBase.toLocaleString('es-AR')} ={' '}
                        <strong className="text-green-700">
                          ${(totalAreaActual * engine.seleccion.precioBase).toLocaleString('es-AR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </span>
                    )}
                  </span>
                </div>

                {/* Encabezados tabla */}
                <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_80px_90px_36px] gap-2 text-xs font-semibold text-gray-500 uppercase px-1">
                  <span>Descripción</span>
                  <span>Largo (m)</span>
                  <span>Ancho (m)</span>
                  <span>Cant.</span>
                  <span className="text-right">m²</span>
                  <span />
                </div>

                {piezas.map((pieza) => {
                  const area = calcAreaPieza(pieza);
                  return (
                    <div
                      key={pieza.id}
                      className="grid grid-cols-[2fr_1fr_1fr_80px_90px_36px] gap-2 items-center"
                    >
                      <Input
                        placeholder="Ej: Bacha cocina"
                        value={pieza.descripcion}
                        onChange={e => handlePiezaChange(pieza.id, 'descripcion', e.target.value)}
                        className="text-sm"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="m"
                        value={pieza.largo_cm === '' ? '' : cmToM(pieza.largo_cm)}
                        onChange={e =>
                          handlePiezaChange(
                            pieza.id,
                            'largo_cm',
                            e.target.value === '' ? '' : mToCm(e.target.value),
                          )
                        }
                        className="text-sm"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="m"
                        value={pieza.ancho_cm === '' ? '' : cmToM(pieza.ancho_cm)}
                        onChange={e =>
                          handlePiezaChange(
                            pieza.id,
                            'ancho_cm',
                            e.target.value === '' ? '' : mToCm(e.target.value),
                          )
                        }
                        className="text-sm"
                      />
                      <Input
                        type="number"
                        min="1"
                        value={pieza.cantidad}
                        onChange={e =>
                          handlePiezaChange(
                            pieza.id,
                            'cantidad',
                            Math.max(1, parseInt(e.target.value || '1', 10)),
                          )
                        }
                        className="text-sm"
                      />
                      <span className="text-right text-sm font-mono text-cyan-700 self-center">
                        {area > 0 ? area.toFixed(3) : '—'}
                      </span>
                      <button
                        onClick={() => handleEliminarPieza(pieza.id)}
                        disabled={piezas.length === 1}
                        title="Eliminar pieza"
                        aria-label="Eliminar pieza"
                        className="flex items-center justify-center w-8 h-8 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPiezas(prev => [...prev, nuevaPieza()])}
                    className="gap-1"
                  >
                    <Plus className="w-4 h-4" /> Agregar Pieza
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerificarStock}
                    className="gap-1 text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                  >
                    <Search className="w-4 h-4" /> Verificar Stock
                  </Button>
                  <Button
                    onClick={handleAgregarItem}
                    className="gap-1 bg-green-600 hover:bg-green-700 text-white ml-auto"
                    disabled={totalAreaActual <= 0}
                  >
                    <CheckCircle className="w-4 h-4" /> Agregar Ítem
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasCliente && (
        <Card className="shadow-md border-cyan-100">
          <CardHeader className="border-b bg-gray-50/50">
            <CardTitle className="text-lg text-cyan-900">Insumos Rápidos</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant={insumoTipo === 'articulo' ? 'default' : 'outline'} onClick={() => { setInsumoTipo('articulo'); setInsumoSeleccionadoId(''); }}>
                Artículos
              </Button>
              <Button variant={insumoTipo === 'accesorio' ? 'default' : 'outline'} onClick={() => { setInsumoTipo('accesorio'); setInsumoSeleccionadoId(''); }}>
                Accesorios
              </Button>
            </div>

            <Select value={insumoSeleccionadoId} onValueChange={setInsumoSeleccionadoId}>
              <SelectTrigger>
                <SelectValue placeholder={engine.loadingArticulos ? 'Cargando insumos...' : 'Seleccione un insumo'} />
              </SelectTrigger>
              <SelectContent>
                {(insumoTipo === 'accesorio' ? accesorios : articulos).map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nombre} - ${Number(i.precio_unitario || 0).toLocaleString('es-AR')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button className="w-full" onClick={handleAgregarInsumo} disabled={!insumoSeleccionadoId}>
              Agregar al presupuesto
            </Button>
          </CardContent>
        </Card>
      )}

      {hasCliente && (
        <Card className="shadow-md border-cyan-100">
          <CardHeader className="border-b bg-gray-50/50">
            <CardTitle className="text-lg text-cyan-900">Extras</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ExtrasEditor
              extras={engine.extras}
              setExtras={engine.setExtras}
              paymentInfo={engine.paymentInfo}
              setPaymentInfo={engine.setPaymentInfo}
              totalPagar={totalFinal}
              showPago={false}
            />
          </CardContent>
        </Card>
      )}

      {/* ÍTEMS AGREGADOS */}
      {engine.items.length > 0 && (
        <Card className="shadow-md border-green-100">
          <CardHeader className="border-b bg-green-50/50">
            <CardTitle className="text-lg text-green-900">Ítems del Presupuesto</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {engine.items.map((item: any, idx: number) => {
              const piezasList: any[] = item.planoData?.primitives?.[0]?.piezas || [];
              const area = Number(item.planoData.areaUtilizada || 0);
              const subtotal = item.seleccion.precioBase * area;
              return (
                <div key={item.id} className="flex justify-between items-start p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="font-semibold text-sm text-gray-900">
                      {item.seleccion.materialNombre}
                      {item.seleccion.loteCodigo && (
                        <span className="text-gray-400 ml-1 font-normal">({item.seleccion.loteCodigo})</span>
                      )}
                    </span>
                    {piezasList.length > 0 && (
                      <span className="text-xs text-gray-500 truncate">
                        {piezasList.map((p: any, i: number) =>
                          `${p.label || `P${i + 1}`}: ${formatDimensionesM(Number(p.w_cm || p.w || 0), Number(p.h_cm || p.h || 0), Number(p.qty || 1))}`
                        ).join(' | ')}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {area.toFixed(3)} m² × ${item.seleccion.precioBase.toLocaleString('es-AR')}/m²
                    </span>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <span className="font-bold text-cyan-700 whitespace-nowrap">
                      ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <button
                      onClick={() => engine.eliminarItem(idx)}
                      title="Eliminar ítem"
                      aria-label="Eliminar ítem"
                      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

        </div>

        <div className="space-y-6 xl:sticky xl:top-4">
          <Card className="shadow-lg border-cyan-200 bg-cyan-50/40">
            <CardHeader className="border-b bg-cyan-100/50">
              <CardTitle className="text-lg text-cyan-900">Desglose en Vivo</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="flex justify-between text-sm text-gray-700">
                <span>Materiales</span>
                <span>${subtotalMateriales.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-700">
                <span>Artículos / Accesorios</span>
                <span>${subtotalArticulos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-700">
                <span>Extras</span>
                <span>${subtotalExtras.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {descuentoMonto > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Descuento{engine.paymentInfo.descuento?.tipo === 'porcentaje' ? ` (${descuentoVal}%)` : ''}</span>
                  <span>−${descuentoMonto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-700">
                <span>Subtotal Neto</span>
                <span>${subtotalNeto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-700">
                <span>IVA (21%)</span>
                <span>${ivaMonto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-xl font-black text-gray-900">TOTAL</span>
                <span className="text-2xl font-black text-cyan-700">
                  ${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <Button
                onClick={handleImprimir}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white gap-2 text-base"
                disabled={engine.items.length === 0}
              >
                <Printer className="w-5 h-5" /> Imprimir Presupuesto
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL VERIFICAR STOCK */}
      <Dialog open={stockModalOpen} onOpenChange={setStockModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Stock disponible — {engine.seleccion.materialNombre}</DialogTitle>
          </DialogHeader>
          {loadingStock ? (
            <p className="text-sm text-gray-500 py-4">Cargando stock...</p>
          ) : stockInfo.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No hay stock registrado para este material.</p>
          ) : (
            <div className="space-y-3">
              {stockInfo.map((lote: any, i: number) => (
                <div key={lote.id || i} className="flex justify-between items-center p-3 bg-gray-50 rounded border">
                  <div>
                    <p className="font-semibold text-sm">{lote.codigo_lote || `Lote ${i + 1}`}</p>
                    <p className="text-xs text-gray-500">
                      {lote.ancho_m && lote.largo_m ? `${lote.ancho_m}m × ${lote.largo_m}m` : ''}
                      {lote.espesor_mm ? ` · ${lote.espesor_mm}mm` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-cyan-700">{Number(lote.stock_actual || 0).toFixed(2)} m²</p>
                    <p className="text-xs text-gray-400">disponible</p>
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 space-y-1">
                <p className="font-semibold text-sm text-right">
                  Total disponible: {totalStockDisponible.toFixed(2)} m²
                </p>
                {totalAreaActual > 0 && (
                  <p
                    className={`text-xs text-right ${totalStockDisponible >= totalAreaActual ? 'text-green-600' : 'text-red-600'
                      }`}
                  >
                    {totalStockDisponible >= totalAreaActual
                      ? `✓ Stock suficiente para ${totalAreaActual.toFixed(3)} m² pedidos`
                      : `⚠ Stock insuficiente: necesita ${totalAreaActual.toFixed(3)} m², disponible ${totalStockDisponible.toFixed(2)} m²`}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
