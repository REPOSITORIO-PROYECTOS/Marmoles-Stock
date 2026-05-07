import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { LocationPicker } from '../../components/common/LocationPicker';
import { ChevronRight, RefreshCw, MessageCircle, Mail, MapPin, Map as MapIcon, History, Eye } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { get, post } from '../../api';
import {
  normalizeWhatsAppNumberAr,
  buildPresupuestoWhatsAppMessage,
  openWhatsAppChat,
  copyTextToClipboard,
} from '../../utils/whatsappPresupuesto';
import { usePresupuestoSimple } from '../../hook/usePresupuestoSimple';
import { usePresupuestoMaestros } from '../../hook/usePresupuestoMaestros';
import { downloadPresupuestoPdf, previsualizarPresupuestoPdf } from '../../utils/presupuestoPdfFromApi';
import { HistorialPresupuestosModal, type PresupuestoHistory } from '../../components/ventas/HistorialPresupuestosModal';
import type { Lead } from '../../hook/usePipelineLeads';

type CatalogoDescuentoRow = { id: string; nombre: string; tipo: string; valor: number; unidad?: string | null };
import { ClienteForm } from '../../components/ventas/ClienteForm';
import { ExtrasEditor } from '../../components/ventas/ExtrasEditor';
import { ConstructorAmbientesSection } from '../../components/ventas/presupuesto/ConstructorAmbientesSection';
import { ConstructorProductosAdicionales } from '../../components/ventas/presupuesto/ConstructorProductosAdicionales';
import { PresupuestoClienteBar } from '../../components/ventas/presupuesto/PresupuestoClienteBar';
import { PresupuestoModalShell } from '../../components/ventas/presupuesto/PresupuestoModalShell';
import {
  ambienteVacio,
  ambientesDesdeLineas,
  metrosCuadradosPieza,
  metrosCuadradosTotalesPieza,
  cantidadPiezasValida,
  subtotalMaterialPieza,
  type AmbientePresupuesto,
  type ProductoAdicionalLinea,
} from '../../types/presupuestoConstructor';

function reviveAmbientesMeta(raw: unknown): AmbientePresupuesto[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  try {
    return raw.map((a: any) => ({
      id: String(a.id || ''),
      nombre: String(a.nombre || 'Ambiente'),
      piezas: (a.piezas || []).map((p: any) => ({
        id: String(p.id || ''),
        material_id: String(p.material_id || ''),
        material_nombre: String(p.material_nombre || p.material || ''),
        precio_m2: Number(p.precio_m2 ?? p.precio_unitario ?? 0),
        m2: Number(p.m2 ?? p.metros_cuadrados ?? 0),
        largo_m: Number(p.largo_m ?? 0),
        ancho_m: Number(p.ancho_m ?? 0),
        cantidad_piezas: Math.max(1, Math.floor(Number(p.cantidad_piezas ?? 1))),
        medidas: String(p.medidas || ''),
        lote_id: p.lote_id ? String(p.lote_id) : undefined,
        geometria_json: p.geometria_json ? String(p.geometria_json) : undefined,
        extras: (p.extras || []).map((e: any) => ({
          id: String(e.id || `${Date.now()}`),
          servicio_id: String(e.servicio_id || ''),
          nombre: String(e.nombre || ''),
          precio: Number(e.precio ?? e.precio_unitario ?? 0),
          cantidad: Number(e.cantidad ?? 1),
        })),
      })),
    }));
  } catch {
    return null;
  }
}

function mapMetaItemsToProductos(items: unknown): ProductoAdicionalLinea[] {
  if (!Array.isArray(items)) return [];
  return items.map((x: any, i: number) => ({
    id: String(x.id || `p-${i}`),
    producto_id: x.producto_id ? String(x.producto_id) : undefined,
    nombre: String(x.nombre || ''),
    precio: Number(x.precio || 0),
    cantidad: Number(x.cantidad ?? 1),
  }));
}

export function ConstructorPresupuestos() {
  const engine = usePresupuestoSimple();
  const maestros = usePresupuestoMaestros();
  const location = useLocation();
  const navigate = useNavigate();

  const [ambientes, setAmbientes] = useState<AmbientePresupuesto[]>(() => [ambienteVacio('General')]);
  const [productosAdicionales, setProductosAdicionales] = useState<ProductoAdicionalLinea[]>([]);
  const [materiales, setMateriales] = useState<Awaited<ReturnType<typeof maestros.fetchMateriales>>>([]);
  const [extrasCat, setExtrasCat] = useState<Awaited<ReturnType<typeof maestros.fetchExtras>>>([]);
  const [prodCat, setProdCat] = useState<Awaited<ReturnType<typeof maestros.fetchProductosAdicionales>>>([]);
  const [clienteModalOpen, setClienteModalOpen] = useState(false);
  const [clienteModalMode, setClienteModalMode] = useState<'create' | 'edit'>('create');
  const [mapObraOpen, setMapObraOpen] = useState(false);
  const prevClienteBeforeModalRef = useRef<string>('');
  const clienteModalSavedRef = useRef(false);

  const [plazosPago, setPlazosPago] = useState<{ id: string; nombre: string; codigo: string }[]>([]);
  const [catalogoDescuentos, setCatalogoDescuentos] = useState<CatalogoDescuentoRow[]>([]);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [savingPresupuesto, setSavingPresupuesto] = useState(false);

  const engineRef = useRef(engine);
  engineRef.current = engine;

  const lastClearNavKeyRef = useRef<string | undefined>(undefined);
  const prevPresupuestoIdRef = useRef<string | null>(null);

  const refreshMateriales = useCallback(async () => {
    const rows = await maestros.fetchMateriales();
    setMateriales(rows);
  }, [maestros.fetchMateriales]);

  const refreshExtras = useCallback(async () => {
    const rows = await maestros.fetchExtras(true);
    setExtrasCat(rows);
  }, [maestros.fetchExtras]);

  const refreshProd = useCallback(async () => {
    const rows = await maestros.fetchProductosAdicionales();
    setProdCat(rows);
  }, [maestros.fetchProductosAdicionales]);

  useLayoutEffect(() => {
    engineRef.current.clearPendingBudgetLoad();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, e, p] = await Promise.all([
          maestros.fetchMateriales(),
          maestros.fetchExtras(true),
          maestros.fetchProductosAdicionales(),
        ]);
        if (!cancelled) {
          setMateriales(m);
          setExtrasCat(e);
          setProdCat(p);
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Solo montaje: maestros.* son estables (useCallback [] en el hook)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await get<{ id: string; nombre: string; codigo: string }[]>('/api/plazos-pago-catalogo');
        if (!cancelled && Array.isArray(rows)) setPlazosPago(rows);
      } catch {
        /* catálogo opcional en entornos viejos */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await get<CatalogoDescuentoRow[]>('/api/descuentos-catalogo');
        if (!cancelled && Array.isArray(rows)) {
          setCatalogoDescuentos(
            rows.filter((r) => r && String(r.id || '').trim() && String(r.nombre || '').trim()),
          );
        }
      } catch {
        if (!cancelled) setCatalogoDescuentos([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const extrasCatFiltrados = useMemo(() => {
    const seen = new Set<string>();
    return extrasCat.filter((x) => {
      const nom = String(x?.nombre ?? '').trim();
      if (!nom) return false;
      if (!String(x?.id ?? '').trim()) return false;
      if (seen.has(x.id)) return false;
      seen.add(x.id);
      return true;
    });
  }, [extrasCat]);

  useEffect(() => {
    if (!plazosPago.length) return;
    engineRef.current.setPaymentInfo((prev) => {
      if (prev.plazoPagoCatalogoId) return prev;
      const byCode = plazosPago.find((p) => p.codigo === prev.tipoCobro);
      if (byCode) return { ...prev, plazoPagoCatalogoId: byCode.id };
      return {
        ...prev,
        plazoPagoCatalogoId: plazosPago[0].id,
        tipoCobro: plazosPago[0].codigo,
      };
    });
  }, [plazosPago]);

  const params = new URLSearchParams(location.search);
  const presupuestoIdParam = params.get('presupuestoId');

  useEffect(() => {
    if (!presupuestoIdParam) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await get<{
          cliente_id?: string;
          direccion_obra_texto?: string | null;
          coordenadas?: string | null;
          lat?: number | null;
          lng?: number | null;
          place_id?: string | null;
          lineas?: Record<string, unknown>[];
          meta?: Record<string, unknown>;
        }>(`/api/presupuestos/${presupuestoIdParam}`);
        if (cancelled) return;
        if (data.cliente_id) engineRef.current.setCliente(data.cliente_id);
        const meta = data.meta || {};
        const fromMeta = reviveAmbientesMeta(meta.ambientes);
        if (fromMeta) setAmbientes(fromMeta);
        else setAmbientes(ambientesDesdeLineas(data.lineas || []));
        setProductosAdicionales(mapMetaItemsToProductos(meta.items_adicionales));
        const descuentoMeta = meta.descuento as { tipo?: string; valor?: number } | undefined;
        const descuentoTipo = descuentoMeta?.tipo === 'porcentaje' ? 'porcentaje' : 'fijo';
        const dcId = (meta.descuento_catalogo_id as string) || null;
        engineRef.current.setPaymentInfo({
          tipoCobro: (meta.tipo_cobro as string) || 'contado',
          conFactura: Boolean(meta.con_factura),
          plazoPagoCatalogoId: (meta.plazo_pago_catalogo_id as string) || null,
          condicionesPagoTexto: String(
            (meta as { condiciones_pago_texto_usuario?: string }).condiciones_pago_texto_usuario ?? '',
          ),
          descuento: {
            catalogoId: dcId,
            tipo: descuentoTipo,
            valor: Number(descuentoMeta?.valor || 0),
          },
        });
        const obsObra = (meta as { observaciones_acceso_obra?: string }).observaciones_acceso_obra;
        engineRef.current.setUbicacionObra({
          direccion: String(data.direccion_obra_texto ?? ''),
          coordenadas: String(data.coordenadas ?? ''),
          place_id: String(data.place_id ?? ''),
          lat: typeof data.lat === 'number' ? data.lat : undefined,
          lng: typeof data.lng === 'number' ? data.lng : undefined,
          observaciones_acceso: obsObra != null ? String(obsObra) : '',
        });
        toast.success('Presupuesto cargado');
      } catch (e) {
        console.error(e);
        toast.error('No se pudo cargar el presupuesto');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar id en URL
  }, [presupuestoIdParam]);

  /**
   * Limpia solo cuando:
   * - cambia `location.key` (nueva entrada a la ruta), o
   * - se deja de tener `presupuestoId` en la URL (misma key).
   * Nunca depende del objeto `engine` (nueva referencia cada render → loop infinito).
   */
  useEffect(() => {
    const prevPid = prevPresupuestoIdRef.current;
    if (presupuestoIdParam) {
      prevPresupuestoIdRef.current = presupuestoIdParam;
      return;
    }
    prevPresupuestoIdRef.current = presupuestoIdParam;

    const key = location.key;
    if (!key) return;

    const keyChanged = lastClearNavKeyRef.current !== key;
    const pidJustCleared = Boolean(prevPid) && !presupuestoIdParam;

    if (!keyChanged && !pidJustCleared) return;

    lastClearNavKeyRef.current = key;
    engineRef.current.limpiarTodo();
    setAmbientes([ambienteVacio('General')]);
    setProductosAdicionales([]);
  }, [location.key, presupuestoIdParam]);

  const subtotalMateriales = useMemo(
    () =>
      ambientes.reduce(
        (acc, amb) =>
          acc + amb.piezas.reduce((s, p) => s + subtotalMaterialPieza(p), 0),
        0,
      ),
    [ambientes],
  );

  const subtotalExtrasPiezas = useMemo(
    () =>
      ambientes.reduce(
        (acc, amb) =>
          acc +
          amb.piezas.reduce(
            (s, p) => s + p.extras.reduce((e, x) => e + x.precio * x.cantidad, 0),
            0,
          ),
        0,
      ),
    [ambientes],
  );

  const subtotalProductosAdic = useMemo(
    () => productosAdicionales.reduce((s, p) => s + p.precio * p.cantidad, 0),
    [productosAdicionales],
  );

  const bruto = subtotalMateriales + subtotalExtrasPiezas + subtotalProductosAdic;
  const descuentoVal = Number(engine.paymentInfo.descuento?.valor || 0);
  const descuentoMonto =
    engine.paymentInfo.descuento?.tipo === 'porcentaje'
      ? bruto * (descuentoVal / 100)
      : descuentoVal;
  const subtotalNetoSinIva = Math.max(0, bruto - descuentoMonto);
  const ivaPreview = subtotalNetoSinIva * 0.21;
  const totalFinal = subtotalNetoSinIva + ivaPreview;

  /** @returns id del presupuesto guardado o `false`. No usar `engine.ultimoPresupuesto` justo después: el estado de React puede no haberse actualizado aún. */
  const handleGuardar = async (opts?: { skipPostSaveNavigate?: boolean }): Promise<string | false> => {
    if (savingPresupuesto) return false;
    setSavingPresupuesto(true);
    const wasEditing = Boolean(presupuestoIdParam);
    try {
      const savedId = await engine.guardarPresupuestoConstructor({
        ambientes,
        productosAdicionales,
        presupuestoIdEdicion: presupuestoIdParam || undefined,
      });
      if (savedId === false) return false;
      if (!presupuestoIdParam && !opts?.skipPostSaveNavigate) {
        navigate(`/ventas/presupuestos?presupuestoId=${savedId}`, { replace: true });
      }
      if (wasEditing && typeof savedId === 'string') {
        const c =
          engine.cliente && engine.cliente !== 'nuevo'
            ? engine.clientesList.find((x: { id: string }) => x.id === engine.cliente)
            : null;
        const cr = c as Record<string, unknown> | undefined;
        try {
          await downloadPresupuestoPdf(savedId, {
            nombre: String(engine.formCliente.nombre || (cr?.nombre as string) || 'Cliente'),
            dni: (cr?.dni as string | undefined) ?? (cr?.cuit as string | undefined),
            direccion: String(engine.formCliente.direccion || (cr?.direccion as string) || ''),
            telefono: String(engine.formCliente.telefono || (cr?.telefono as string) || ''),
            coordenadas: String(engine.formCliente.coordenadas || (cr?.coordenadas as string) || ''),
          });
          toast.success('PDF actualizado con los cambios guardados');
        } catch (e) {
          console.error(e);
          toast.error('Presupuesto guardado; no se pudo regenerar el PDF');
        }
      }
      return savedId;
    } finally {
      setSavingPresupuesto(false);
    }
  };

  const openAltaRapida = () => {
    prevClienteBeforeModalRef.current = engine.cliente;
    clienteModalSavedRef.current = false;
    engine.setFormCliente({
      nombre: '',
      email: '',
      telefono: '',
      direccion: '',
      coordenadas: '',
      place_id: '',
      lat: undefined,
      lng: undefined,
    });
    setClienteModalMode('create');
    setClienteModalOpen(true);
  };

  const openEditarCliente = () => {
    clienteModalSavedRef.current = false;
    setClienteModalMode('edit');
    setClienteModalOpen(true);
  };

  /** Mismas validaciones que el antiguo “Imprimir/PDF”: guarda y lleva al lead en el pipeline. */
  const handleGuardarYLead = async () => {
    if (savingPresupuesto) return;
    if (!engine.cliente && !engine.formCliente.nombre) {
      toast.error('Seleccione o ingrese un cliente');
      return;
    }
    const hasPiezas = ambientes.some((a) =>
      a.piezas.some((p) => p.material_id && metrosCuadradosPieza(p) > 0),
    );
    if (!hasPiezas && subtotalProductosAdic <= 0) {
      toast.error('Agregue al menos una pieza o un producto adicional');
      return;
    }
    const savedId = await handleGuardar({ skipPostSaveNavigate: true });
    if (savedId === false) return;

    const pid = savedId;

    try {
      const data = await get<{ meta?: { lead_id?: string } | null }>(`/api/presupuestos/${pid}`);
      let leadId: string | null = null;
      const m = data.meta;
      if (m && typeof m === 'object' && m.lead_id != null && String(m.lead_id).trim() !== '') {
        leadId = String(m.lead_id).trim();
      }
      if (!leadId) {
        const leadsRaw = await get<unknown>(`/api/leads`);
        const arr = Array.isArray(leadsRaw) ? leadsRaw : [];
        const found = arr.find(
          (l: { presupuesto_relacionado_id?: string | null }) =>
            String(l.presupuesto_relacionado_id || '') === pid,
        ) as { id?: string } | undefined;
        leadId = found?.id ? String(found.id) : null;
      }
      if (leadId) {
        const q = new URLSearchParams();
        q.set('highlightLeadId', leadId);
        q.set('openLeadModal', leadId);
        navigate(`/ventas/leads?${q.toString()}`);
      } else {
        console.warn('[GUARDAR/LEAD] Sin lead_id en meta ni match en /api/leads para presupuesto', pid);
        navigate('/ventas/leads');
        toast.warning('Presupuesto guardado. No se encontró el lead vinculado en el pipeline.');
      }
    } catch (e) {
      console.error(e);
      navigate('/ventas/leads');
      toast.warning('Presupuesto guardado. No se pudo ubicar el lead; revise el pipeline.');
    }
  };

  const handleEnviarWhatsApp = async () => {
    if (savingPresupuesto) return;
    const datosCliente =
      engine.clientesList.find((c: any) => c.id === engine.cliente) || engine.formCliente;
    const e164 = normalizeWhatsAppNumberAr(String(datosCliente?.telefono || ''));
    if (!e164) {
      toast.error('El cliente no tiene teléfono válido para WhatsApp');
      return;
    }
    let presupuestoIdParaMeta = engine.ultimoPresupuesto?.id;
    if (!presupuestoIdParaMeta) {
      const sid = await handleGuardar();
      if (sid === false) return;
      presupuestoIdParaMeta = sid;
    }
    const correlativo = Number(engine.ultimoPresupuesto?.correlativo_global || 0);
    const mensaje = buildPresupuestoWhatsAppMessage({
      nombreCliente: datosCliente?.nombre,
      correlativo: correlativo > 0 ? correlativo : undefined,
    });
    const opened = openWhatsAppChat(e164, mensaje);
    if (!opened) {
      const copied = await copyTextToClipboard(mensaje);
      toast[copied ? 'warning' : 'error'](
        copied
          ? 'Ventana bloqueada. Mensaje copiado al portapapeles.'
          : 'No se pudo abrir WhatsApp.',
      );
    }
    const pid = presupuestoIdParaMeta;
    if (pid) {
      try {
        const current = await get<Record<string, unknown>>(`/api/presupuestos/${pid}/meta`).catch(
          () => null,
        );
        const base = current && typeof current === 'object' ? { ...current } : {};
        await post(`/api/presupuestos/${pid}/meta`, {
          data: {
            ...base,
            enviado_whatsapp_at: new Date().toISOString(),
            ultima_interaccion_canal: 'whatsapp',
          },
        });
      } catch {
        /* noop */
      }
    }
  };

  const hasCliente = Boolean(engine.cliente && engine.cliente !== 'nuevo');

  const handleHistorialDownloadPdf = async (presupuestoId: string, lead: Lead) => {
    try {
      await downloadPresupuestoPdf(presupuestoId, {
        nombre: lead.nombre,
        dni: lead.dni,
        direccion: lead.direccion || '',
        telefono: lead.telefono || '',
        coordenadas: lead.coordenadas,
      });
    } catch (e) {
      console.error(e);
      toast.error('Error al descargar presupuesto');
    }
  };

  const clientePayloadParaPdf = () => {
    const c =
      engine.cliente && engine.cliente !== 'nuevo'
        ? engine.clientesList.find((x: { id: string }) => x.id === engine.cliente)
        : null;
    const cr = c as Record<string, unknown> | undefined;
    return {
      nombre: String(engine.formCliente.nombre || (cr?.nombre as string) || 'Cliente'),
      dni: (cr?.dni as string | undefined) ?? (cr?.cuit as string | undefined),
      direccion: String(engine.formCliente.direccion || (cr?.direccion as string) || ''),
      telefono: String(engine.formCliente.telefono || (cr?.telefono as string) || ''),
      coordenadas: String(engine.formCliente.coordenadas || (cr?.coordenadas as string) || ''),
    };
  };

  const handleVistaPreviaPdfConstructor = async () => {
    const pid = presupuestoIdParam || engine.ultimoPresupuesto?.id;
    if (!pid) {
      toast.error('Guarde el presupuesto para ver la vista previa');
      return;
    }
    try {
      await previsualizarPresupuestoPdf(pid, clientePayloadParaPdf());
    } catch (e) {
      console.error(e);
      toast.error('No se pudo abrir la vista previa');
    }
  };

  const handleHistorialEditLead = async (presupuesto: PresupuestoHistory) => {
    setIsHistoryDialogOpen(false);
    navigate('/ventas/leads', { state: { openPresupuestoForLeadEdit: presupuesto } });
  };

  const handleHistorialEditPresupuesto = async (presupuesto: PresupuestoHistory) => {
    setIsHistoryDialogOpen(false);
    navigate(`/ventas/presupuestos?presupuestoId=${presupuesto.id}`, { replace: true });
  };

  return (
    <div className="w-full px-3 sm:px-6 py-4 sm:py-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Presupuesto <span className="text-blue-600">constructor</span>
            {presupuestoIdParam ? (
              <span className="ml-2 text-sm font-normal text-amber-700">(edición)</span>
            ) : null}
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm">
            Ambiente → piezas → extras · Productos adicionales aparte · Precios netos
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {(presupuestoIdParam || engine.ultimoPresupuesto?.id) && (
            <Button
              variant="outline"
              onClick={() => void handleVistaPreviaPdfConstructor()}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              Vista previa PDF
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setIsHistoryDialogOpen(true)}
            className="gap-2"
          >
            <History className="w-4 h-4" />
            Historial de Presupuestos
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              engine.limpiarTodo();
              setAmbientes([ambienteVacio('General')]);
              setProductosAdicionales([]);
            }}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Nuevo
          </Button>
        </div>
      </div>

      <HistorialPresupuestosModal
        isOpen={isHistoryDialogOpen}
        onClose={() => setIsHistoryDialogOpen(false)}
        onDownloadPresupuesto={handleHistorialDownloadPdf}
        onEditLead={handleHistorialEditLead}
        onEditPresupuesto={handleHistorialEditPresupuesto}
      />

      <Card className="shadow-md border-blue-100">
        <CardHeader className="border-b bg-gray-50/50 py-3">
          <CardTitle className="text-lg text-blue-900">Cliente</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <PresupuestoClienteBar
            clientes={engine.clientesList}
            clienteId={engine.cliente}
            formCliente={engine.formCliente}
            onSelectCliente={(id) => engine.setCliente(id)}
            onAltaRapida={openAltaRapida}
            onEditarCliente={openEditarCliente}
          />
        </CardContent>
      </Card>

      {hasCliente && (
        <Card className="shadow-md border-blue-100">
          <CardHeader className="border-b bg-gray-50/50 py-3">
            <CardTitle className="text-lg text-blue-900">Ubicación de la obra</CardTitle>
            <p className="text-xs text-muted-foreground font-normal mt-1">
              Opcional. Corresponde a esta obra/presupuesto, no al domicilio del cliente.
            </p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-3">
            <div className="space-y-2">
              <Label>Dirección o referencia</Label>
              <Input
                value={engine.ubicacionObra.direccion}
                onChange={(e) =>
                  engine.setUbicacionObra((prev) => ({ ...prev, direccion: e.target.value }))
                }
                placeholder="Calle, ciudad o indicaciones"
              />
            </div>
            <div className="space-y-2">
              <Label>Coordenadas (GPS)</Label>
              <div className="flex gap-2">
                <Input
                  value={engine.ubicacionObra.coordenadas}
                  onChange={(e) =>
                    engine.setUbicacionObra((prev) => ({ ...prev, coordenadas: e.target.value }))
                  }
                  placeholder="-31.52, -68.54"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  title="Abrir en Google Maps"
                  disabled={!engine.ubicacionObra.coordenadas?.trim()}
                  onClick={() => {
                    const q = String(engine.ubicacionObra.coordenadas).replace(/\s/g, '');
                    window.open(`https://www.google.com/maps?q=${encodeURIComponent(q)}`, '_blank');
                  }}
                >
                  <MapPin className="h-4 w-4 text-blue-600" />
                </Button>
                <Dialog open={mapObraOpen} onOpenChange={setMapObraOpen}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 bg-green-50 hover:bg-green-100 border-green-200"
                      title="Elegir en mapa"
                    >
                      <MapIcon className="h-4 w-4 text-green-600" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl h-[70vh] rounded-xl">
                    <DialogHeader>
                      <DialogTitle>Ubicación de la obra</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 h-full min-h-0">
                      <LocationPicker
                        initialCoordinates={engine.ubicacionObra.coordenadas}
                        onConfirm={(loc) => {
                          const coordsMatch = loc.address.match(/\[(.*?)\]/);
                          const coordsFromAddress = coordsMatch ? coordsMatch[1].trim() : '';
                          const cleanAddress = loc.address.replace(/\s\[.*?\]/, '').trim();
                          engine.setUbicacionObra((prev) => ({
                            ...prev,
                            direccion: cleanAddress || prev.direccion,
                            coordenadas: coordsFromAddress || `${loc.lat}, ${loc.lng}`,
                            place_id: loc.placeId,
                            lat: loc.lat,
                            lng: loc.lng,
                          }));
                          setMapObraOpen(false);
                        }}
                        onCancel={() => setMapObraOpen(false)}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observaciones de acceso</Label>
              <Textarea
                rows={3}
                value={engine.ubicacionObra.observaciones_acceso}
                onChange={(e) =>
                  engine.setUbicacionObra((prev) => ({
                    ...prev,
                    observaciones_acceso: e.target.value,
                  }))
                }
                placeholder="Portón, piso, horario…"
                className="resize-y min-h-[72px]"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={clienteModalOpen}
        onOpenChange={(open) => {
          if (open) {
            setClienteModalOpen(true);
            return;
          }
          const saved = clienteModalSavedRef.current;
          if (!saved && clienteModalMode === 'create' && prevClienteBeforeModalRef.current) {
            engine.setCliente(prevClienteBeforeModalRef.current);
          }
          clienteModalSavedRef.current = false;
          setClienteModalOpen(false);
        }}
      >
        <PresupuestoModalShell
          title={clienteModalMode === 'create' ? 'Alta rápida de cliente' : 'Editar cliente'}
          description="Nombre, teléfono y email. La obra se indica aparte."
        >
          <ClienteForm
            clientes={engine.clientesList}
            clienteId={clienteModalMode === 'create' ? 'nuevo' : engine.cliente}
            formCliente={engine.formCliente}
            editingExisting={clienteModalMode === 'edit'}
            embedded
            hideSelector
            soloDatosContacto
            onSelect={() => {}}
            onFormChange={engine.setFormCliente}
            onGuardarNuevo={async () => {
              if (clienteModalMode === 'edit') {
                const ok = await engine.guardarEdicionCliente();
                if (ok) {
                  clienteModalSavedRef.current = true;
                  setClienteModalOpen(false);
                }
                return;
              }
              const r = await engine.registrarNuevoCliente();
              if (r) {
                clienteModalSavedRef.current = true;
                setClienteModalOpen(false);
              }
            }}
            onEditarExistente={() => {}}
          />
          <Button type="button" variant="outline" className="w-full mt-3" onClick={() => setClienteModalOpen(false)}>
            Cancelar
          </Button>
        </PresupuestoModalShell>
      </Dialog>

      {hasCliente && (
        <>
          <ConstructorAmbientesSection
            ambientes={ambientes}
            setAmbientes={setAmbientes}
            materiales={materiales}
            extrasCat={extrasCatFiltrados}
            refreshMateriales={refreshMateriales}
            refreshExtras={refreshExtras}
            maestros={maestros}
          />

          <ConstructorProductosAdicionales
            productos={productosAdicionales}
            setProductos={setProductosAdicionales}
            catalogo={prodCat}
            refreshCatalogo={refreshProd}
            maestros={maestros}
          />

          <Card className="shadow-md border-blue-100">
            <CardHeader className="border-b bg-gray-50/50">
              <CardTitle className="text-lg text-blue-900">Condiciones de pago y descuentos</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ExtrasEditor
                extras={[]}
                setExtras={() => {}}
                paymentInfo={engine.paymentInfo}
                setPaymentInfo={engine.setPaymentInfo}
                totalPagar={totalFinal}
                paymentOnly
                condicionesConstructor
                plazosPago={plazosPago}
                catalogoDescuentosDesdePadre={catalogoDescuentos}
              />
            </CardContent>
          </Card>

          <Card className="shadow-lg border-blue-200 bg-blue-50/30">
            <CardContent className="p-6 space-y-3">
              <p className="text-sm font-semibold text-gray-800">Resumen de ítems (neto)</p>
              <div className="rounded-md border bg-white/80 text-xs overflow-hidden">
                <div className="bg-slate-100 px-2 py-1 font-medium text-slate-700">Materiales / piezas</div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-2 py-1 font-normal">Nombre</th>
                      <th className="px-2 py-1 font-normal text-right w-24">m² total</th>
                      <th className="px-2 py-1 font-normal text-right w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ambientes.flatMap((amb) =>
                      amb.piezas
                        .filter((p) => p.material_nombre && metrosCuadradosPieza(p) > 0)
                        .map((p) => {
                          const m2u = metrosCuadradosPieza(p);
                          const q = cantidadPiezasValida(p);
                          const m2tot = metrosCuadradosTotalesPieza(p);
                          const st = subtotalMaterialPieza(p);
                          return (
                            <tr key={p.id} className="border-b border-slate-100">
                              <td className="px-2 py-1">
                                {amb.nombre} — {p.material_nombre}
                              </td>
                              <td className="px-2 py-1 text-right" title={q > 1 ? `${q} piezas × ${m2u} m²` : undefined}>
                                {q > 1 ? `${q}×${m2u}` : m2tot}
                              </td>
                              <td className="px-2 py-1 text-right">
                                ${st.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        }),
                    )}
                  </tbody>
                </table>
                {ambientes.every((a) => !a.piezas.some((p) => metrosCuadradosPieza(p) > 0)) ? (
                  <p className="px-2 py-2 text-muted-foreground">Sin piezas cargadas</p>
                ) : null}
              </div>
              <div className="rounded-md border bg-white/80 text-xs overflow-hidden">
                <div className="bg-slate-100 px-2 py-1 font-medium text-slate-700">Extras en piezas</div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-2 py-1 font-normal">Nombre</th>
                      <th className="px-2 py-1 font-normal text-right w-20">Cant.</th>
                      <th className="px-2 py-1 font-normal text-right w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ambientes.flatMap((amb) =>
                      amb.piezas.flatMap((p) =>
                        p.extras.map((ex) => (
                          <tr key={ex.id} className="border-b border-slate-100">
                            <td className="px-2 py-1">
                              {ex.nombre} <span className="text-muted-foreground">({amb.nombre})</span>
                            </td>
                            <td className="px-2 py-1 text-right">{ex.cantidad}</td>
                            <td className="px-2 py-1 text-right">
                              ${(ex.precio * ex.cantidad).toLocaleString('es-AR', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        )),
                      ),
                    )}
                  </tbody>
                </table>
                {subtotalExtrasPiezas <= 0 ? (
                  <p className="px-2 py-2 text-muted-foreground">Sin extras</p>
                ) : null}
              </div>
              <div className="rounded-md border bg-white/80 text-xs overflow-hidden">
                <div className="bg-slate-100 px-2 py-1 font-medium text-slate-700">Productos adicionales</div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-2 py-1 font-normal">Nombre</th>
                      <th className="px-2 py-1 font-normal text-right w-20">Cant.</th>
                      <th className="px-2 py-1 font-normal text-right w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosAdicionales.map((pr) => (
                      <tr key={pr.id} className="border-b border-slate-100">
                        <td className="px-2 py-1">{pr.nombre}</td>
                        <td className="px-2 py-1 text-right">{pr.cantidad}</td>
                        <td className="px-2 py-1 text-right">
                          ${(pr.precio * pr.cantidad).toLocaleString('es-AR', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {productosAdicionales.length === 0 ? (
                  <p className="px-2 py-2 text-muted-foreground">Sin adicionales</p>
                ) : null}
              </div>

              <div className="flex justify-between text-sm text-gray-700">
                <span>Subtotal materiales (m²)</span>
                <span>
                  ${subtotalMateriales.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {(subtotalExtrasPiezas > 0 || subtotalProductosAdic > 0) && (
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Extras en piezas + adicionales</span>
                  <span>
                    ${(subtotalExtrasPiezas + subtotalProductosAdic).toLocaleString('es-AR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              {descuentoMonto > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Descuento</span>
                  <span>
                    −$
                    {descuentoMonto.toLocaleString('es-AR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-700">
                <span>Subtotal sin IVA</span>
                <span>
                  ${subtotalNetoSinIva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-700">
                <span>IVA 21%</span>
                <span>
                  ${ivaPreview.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-xl font-black text-gray-900">TOTAL (con IVA)</span>
                <span className="text-2xl font-black text-blue-700" data-testid="total">
                  ${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={handleEnviarWhatsApp} className="gap-2">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const datosCliente =
                      engine.clientesList.find((c: any) => c.id === engine.cliente) || engine.formCliente;
                    const email = datosCliente?.email;
                    if (!email) {
                      toast.error('El cliente no tiene email');
                      return;
                    }
                    const correlativo = Number(engine.ultimoPresupuesto?.correlativo_global || 0);
                    const subject = `Presupuesto ${correlativo ? `#${String(correlativo).padStart(6, '0')}` : ''}`;
                    window.open(
                      `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}`,
                      '_self',
                    );
                  }}
                  className="gap-2"
                >
                  <Mail className="w-4 h-4" /> Email
                </Button>
                <Button
                  type="button"
                  className="gap-2 bg-blue-600"
                  disabled={savingPresupuesto}
                  onClick={() => void handleGuardarYLead()}
                >
                  {savingPresupuesto ? 'Guardando...' : 'GUARDAR / LEAD'}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!hasCliente && (
        <p className="text-sm text-center text-muted-foreground py-6">
          Seleccione un cliente o use &quot;Alta rápida&quot; para continuar.
        </p>
      )}
    </div>
  );
}
