import { useState, useEffect, useCallback } from 'react';
import { get, post, patch, put } from '../api';

/** Ubicación de la obra del presupuesto (no es el domicilio del cliente; Sprint 7.2). */
export type UbicacionObraState = {
  direccion: string;
  coordenadas: string;
  place_id: string;
  lat: number | undefined;
  lng: number | undefined;
  observaciones_acceso: string;
};

function defaultUbicacionObra(): UbicacionObraState {
  return {
    direccion: '',
    coordenadas: '',
    place_id: '',
    lat: undefined,
    lng: undefined,
    observaciones_acceso: '',
  };
}
import { toast } from 'sonner';
import type { AmbientePresupuesto, ProductoAdicionalLinea } from '../types/presupuestoConstructor';
import {
  lineasApiDesdeAmbientes,
  metrosCuadradosPieza,
  subtotalMaterialPieza,
} from '../types/presupuestoConstructor';

interface PresupuestoResponse {
  id: string;
  cliente_id: string;
  lineas: Array<{
    material: string;
    lote_id?: string;
    geometria_json?: string;
    metros_cuadrados: number;
    precio_unitario: number;
  }>;
  meta?: {
    items_adicionales?: any[];
    tipo_cobro?: string;
    con_factura?: boolean;
  };
  total: number;
  observaciones?: string;
}

export function usePresupuestoSimple() {
  // Datos Maestros
  const [clientesList, setClientesList] = useState<any[]>([]);
  const [materialesList, setMaterialesList] = useState<any[]>([]);
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null);

  // Estado de Selección
  const [cliente, setCliente] = useState<string>('');

  const [formCliente, setFormCliente] = useState({
    nombre: '',
    email: '',
    telefono: '',
    direccion: '',
    coordenadas: '',
    place_id: '' as string,
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
  });

  const [ubicacionObra, setUbicacionObra] = useState<UbicacionObraState>(defaultUbicacionObra);

  // Aquí guardamos los lotes que corresponden SOLO al material seleccionado
  const [lotesDisponibles, setLotesDisponibles] = useState<any[]>([]);

  const [seleccion, setSeleccion] = useState({
    materialId: '',
    materialNombre: '',
    loteId: '',       // ID de la placa/retazo específico
    loteCodigo: '',   // Código visible (ej: L-204)
    batchId: '',      // ID del lote (batch) al que pertenece
    precioBase: 0,
    precioMayorista: 0,
    usarMayorista: false,
    stockDisponible: 0,
    unidad: 'm²',
    cantidad: 1
  });
  const [precioTipo, setPrecioTipo] = useState<'menor' | 'mayor'>('menor');

  // Estado de Extras y Pago
  const [extras, setExtras] = useState<any[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<{
    tipoCobro: string;
    conFactura: boolean;
    plazoPagoCatalogoId: string | null;
    /** Texto libre para el PDF; vacío = usar solo el nombre del plazo del catálogo. */
    condicionesPagoTexto: string;
    descuento: { catalogoId: string | null; tipo: 'fijo' | 'porcentaje'; valor: number };
  }>({
    tipoCobro: 'contado',
    conFactura: false,
    plazoPagoCatalogoId: null,
    condicionesPagoTexto: '',
    descuento: {
      catalogoId: null,
      tipo: 'fijo',
      valor: 0
    }
  });

  // Datos del Plano
  const [planoData, setPlanoData] = useState({
    placements: [] as any[],
    features: [] as any[],
    primitives: [] as any[],
    boardConfig: { width: 300, height: 180 },
    areaUtilizada: 0,
  });

  // Estado de Items (Multi-Plancha)
  const [items, setItems] = useState<any[]>([]);

  // Persistencia de Datos
  const [pendingBudgetLoad, setPendingBudgetLoad] = useState<string | null>(null);
  const [ultimoPresupuesto, setUltimoPresupuesto] = useState<any | null>(null);

  // 1. Detectar URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('presupuestoId');
    const lid = params.get('leadId');
    if (pid) {
      setPendingBudgetLoad(pid);
    }
    if (lid) {
      setCurrentLeadId(lid);
    }
  }, []);

  // 2. Cargar presupuesto cuando tengamos materiales listos
  useEffect(() => {
    if (pendingBudgetLoad && materialesList.length > 0) {
      const loadBudget = async (id: string) => {
        try {
          toast.info("Cargando presupuesto...");
          const data = await get<PresupuestoResponse>(`/api/presupuestos/${id}`);

          // Cliente
          if (data.cliente_id) setCliente(data.cliente_id);

          // Lineas (Material, Lote, Plano)
          if (data.lineas && data.lineas.length > 0) {
            const loadedItems: any[] = [];
            for (const linea of data.lineas) {
              const matName = linea.material;
              const mat = materialesList.find(m => m.nombre === matName);
              // Si no encontramos el material en la lista actual, usamos datos genéricos

              const newItem: any = {
                id: Date.now().toString() + Math.random(),
                seleccion: {
                  materialId: mat ? mat.id : '',
                  materialNombre: matName,
                  loteId: linea.lote_id || '',
                  loteCodigo: linea.lote_id ? 'Lote Cargado' : '',
                  batchId: linea.lote_id,
                  precioBase: linea.precio_unitario,
                  stockDisponible: 0,
                  unidad: mat?.unidad || 'm²',
                  cantidad: 1
                },
                planoData: {
                  placements: [],
                  features: [],
                  primitives: [],
                  boardConfig: { width: 300, height: 180 },
                  areaUtilizada: linea.metros_cuadrados,
                }
              };

              if (linea.geometria_json) {
                try {
                  const geo = JSON.parse(linea.geometria_json);
                  if (geo.boardConfig || geo.placements || geo.primitives) {
                    newItem.planoData = { ...newItem.planoData, ...geo };
                  } else if (Array.isArray(geo)) {
                    newItem.planoData.primitives = geo;
                  }
                } catch (e) {
                  console.error("Error parsing geometria_json", e);
                }
              }
              loadedItems.push(newItem);
            }
            setItems(loadedItems);
            // Si hay items, dejamos el editor limpio para agregar uno nuevo
            // Opcional: Podríamos cargar el último en el editor si quisieramos
          }

          // Extras y Pago
          if (data.meta) {
            if (data.meta.items_adicionales) setExtras(data.meta.items_adicionales);
            const descuentoMeta = (data.meta as any)?.descuento;
            const descuentoTipo = descuentoMeta?.tipo === 'porcentaje' ? 'porcentaje' : 'fijo';
            const dcId = (data.meta as any)?.descuento_catalogo_id || null;
            const plazoId = (data.meta as any)?.plazo_pago_catalogo_id || null;
            const textoCond = String(
              (data.meta as { condiciones_pago_texto_usuario?: string }).condiciones_pago_texto_usuario ?? '',
            ).trim();
            setPaymentInfo({
              tipoCobro: data.meta.tipo_cobro || 'contado',
              conFactura: data.meta.con_factura || false,
              plazoPagoCatalogoId: plazoId,
              condicionesPagoTexto: textoCond,
              descuento: {
                catalogoId: dcId,
                tipo: descuentoTipo,
                valor: Number(descuentoMeta?.valor || 0)
              }
            });
          }

          toast.success("Presupuesto cargado exitosamente");
          setPendingBudgetLoad(null); // Clear to avoid loop
        } catch (e) {
          console.error("Error loading budget", e);
          toast.error("Error al cargar el presupuesto");
        }
      };

      loadBudget(pendingBudgetLoad);
    }
  }, [pendingBudgetLoad, materialesList]);

  // NOTA: Se ha eliminado la restauración automática desde localStorage 
  // para cumplir con el requerimiento de que cada vez que se inicie el cotizador
  // el presupuesto esté completamente en blanco.

  // Guardar datos automáticamente cuando cambian (opcional, para persistencia ante refrescos accidentales)
  // Si se desea que sea COMPLETAMENTE volátil, se podría comentar también este bloque.
  useEffect(() => {
    const stateToSave = {
      cliente,
      formCliente,
      ubicacionObra,
      seleccion,
      lotesDisponibles,
      extras,
      paymentInfo,
      planoData,
      currentLeadId // Agregamos el Lead ID a la persistencia
    };

    // Usamos un timeout para no escribir en localStorage en cada render milimétrico
    const timer = setTimeout(() => {
      localStorage.setItem('PRESUPUESTO_TEMP_STATE', JSON.stringify(stateToSave));
    }, 500);

    return () => clearTimeout(timer);
  }, [cliente, formCliente, ubicacionObra, seleccion, lotesDisponibles, extras, paymentInfo, planoData, currentLeadId]);

  const limpiarPersistencia = () => {
    localStorage.removeItem('PRESUPUESTO_TEMP_STATE');
  };

  const clearPendingBudgetLoad = useCallback(() => setPendingBudgetLoad(null), []);

  const limpiarTodo = useCallback(() => {
    setCliente('');
    setFormCliente({
      nombre: '',
      email: '',
      telefono: '',
      direccion: '',
      coordenadas: '',
      place_id: '',
      lat: undefined,
      lng: undefined,
    });
    setUbicacionObra(defaultUbicacionObra());
    setLotesDisponibles([]);
    setSeleccion({
      materialId: '',
      materialNombre: '',
      loteId: '',
      loteCodigo: '',
      batchId: '',
      precioBase: 0,
      precioMayorista: 0,
      usarMayorista: false,
      stockDisponible: 0,
      unidad: 'm²',
      cantidad: 1
    });
    setExtras([]);
    setPaymentInfo({
      tipoCobro: 'contado',
      conFactura: false,
      plazoPagoCatalogoId: null,
      condicionesPagoTexto: '',
      descuento: { catalogoId: null, tipo: 'fijo', valor: 0 }
    });
    setPlanoData({
      placements: [],
      features: [],
      primitives: [],
      boardConfig: { width: 300, height: 180 },
      areaUtilizada: 0,
    });
    setCurrentLeadId(null);
    limpiarPersistencia();

    // Forzar limpieza de localStorage adicional para estar seguros
    localStorage.removeItem('PRESUPUESTO_TEMP_STATE');
  }, []);

  // Carga Inicial de Listas
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        console.log("Cargando clientes...");
        const clientes = await get('/api/clientes');
        const clientesNormalizados = Array.isArray(clientes) ? clientes : [];
        setClientesList(clientesNormalizados);

        console.log("Cargando materiales disponibles...");
        const materiales = await get('/api/materiales');
        const materialesListRaw = Array.isArray(materiales) ? materiales : [];
        console.log("Materiales cargados:", materialesListRaw);
        const compras = await get('/api/compras');
        const comprasList = Array.isArray(compras) ? compras : [];
        const toDateMs = (value: string) => {
          if (!value) return 0;
          const d = new Date(value);
          if (!isNaN(d.getTime())) return d.getTime();
          const partsSlash = value.split('/');
          if (partsSlash.length === 3 && partsSlash[2].length === 4) {
            const [dd, mm, yyyy] = partsSlash.map(p => parseInt(p, 10));
            if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
              return new Date(yyyy, mm - 1, dd).getTime();
            }
          }
          const partsDash = value.split('-');
          if (partsDash.length === 3 && partsDash[0].length === 4) {
            const [yyyy, mm, dd] = partsDash.map(p => parseInt(p, 10));
            if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
              return new Date(yyyy, mm - 1, dd).getTime();
            }
          }
          return 0;
        };
        const byId: Record<string, { menor?: number; mayor?: number; fechaMs: number; idx: number }> = {};
        const byName: Record<string, { menor?: number; mayor?: number; fechaMs: number; idx: number }> = {};
        let idx = 0;
        for (const c of comprasList) {
          const fechaMs = toDateMs((c.fecha || '') as string);
          const menor = c.precio_m2 !== undefined && c.precio_m2 !== null ? Math.max(0, Number(c.precio_m2 || 0)) : undefined;
          const mayor = c.precio_mayor_m2 !== undefined && c.precio_mayor_m2 !== null ? Math.max(0, Number(c.precio_mayor_m2 || 0)) : undefined;
          const materialId = (c.material_id || c.materialId || '') as string;
          const materialName = ((c.material_nombre || c.material) || '').toString().toLowerCase();
          if (materialId) {
            const prev = byId[materialId];
            if (!prev || fechaMs > prev.fechaMs || (fechaMs === prev.fechaMs && idx >= prev.idx)) {
              byId[materialId] = { menor, mayor, fechaMs, idx };
            }
          }
          if (materialName) {
            const prev = byName[materialName];
            if (!prev || fechaMs > prev.fechaMs || (fechaMs === prev.fechaMs && idx >= prev.idx)) {
              byName[materialName] = { menor, mayor, fechaMs, idx };
            }
          }
          idx += 1;
        }
        const materialesEnriquecidos = materialesListRaw.map((m: any) => {
          const idKey = m.id || '';
          const nameKey = (m.nombre || '').toString().toLowerCase();
          const last = (idKey && byId[idKey]) || (nameKey && byName[nameKey]);
          if (!last) return m;
          return {
            ...m,
            precio_m2: last.menor !== undefined ? last.menor : m.precio_m2,
            precio_mayor_m2: last.mayor !== undefined ? last.mayor : m.precio_mayor_m2
          };
        });
        setMaterialesList(materialesEnriquecidos);
      } catch (e) {
        console.error("Error cargando datos iniciales en usePresupuestoSimple", e);
        toast.error("Error al cargar datos básicos");
      }
    };
    cargarDatos();
  }, []);

  // Sync client form data when a client is selected
  useEffect(() => {
    if (cliente && cliente !== 'nuevo') {
      const selected = clientesList.find(c => c.id === cliente);
      if (selected) {
        setFormCliente({
          nombre: selected.nombre || '',
          email: selected.email || '',
          telefono: selected.telefono || '',
          direccion: '',
          coordenadas: '',
          place_id: '',
          lat: undefined,
          lng: undefined,
        });
      }
    } else if (cliente === 'nuevo') {
      setFormCliente({
        nombre: '',
        email: '',
        telefono: '',
        direccion: '',
        coordenadas: '',
        place_id: '',
        lat: undefined,
        lng: undefined,
      });
    }
  }, [cliente, clientesList]);

  // --- LÓGICA CLAVE: MATERIAL -> LOTES ---
  const getPrecioMaterial = (mat: any, tipo: 'menor' | 'mayor') => {
    const menor = Number(mat?.precio_m2 || 0);
    const mayor = mat?.precio_mayor_m2 != null ? Number(mat?.precio_mayor_m2 || 0) : menor;
    return tipo === 'mayor' ? mayor : menor;
  };

  const seleccionarMaterial = async (id: string) => {
    if (id === '__manual__') {
      setSeleccion({
        materialId: id,
        materialNombre: 'Material Manual',
        precioBase: 0,
        precioMayorista: 0,
        usarMayorista: false,
        loteId: '',
        loteCodigo: '',
        batchId: '',
        stockDisponible: 0,
        unidad: 'm²',
        cantidad: 1
      });

      setPlanoData({
        placements: [],
        features: [],
        primitives: [],
        boardConfig: { width: 300, height: 180 },
        areaUtilizada: 0,
      });

      setLotesDisponibles([]);
      return [];
    }
    if (id === '__sin_material__') {
      setSeleccion({
        materialId: id,
        materialNombre: 'Sin material',
        precioBase: 0,
        precioMayorista: 0,
        usarMayorista: false,
        loteId: '',
        loteCodigo: '',
        batchId: '',
        stockDisponible: 0,
        unidad: 'm²',
        cantidad: 0
      });

      setPlanoData({
        placements: [],
        features: [],
        primitives: [],
        boardConfig: { width: 300, height: 180 },
        areaUtilizada: 0,
      });

      setLotesDisponibles([]);
      return [];
    }

    const mat = materialesList.find(m => m.id === id);
    if (!mat) return;

    // 1. Reseteamos el lote anterior porque cambió el material
    setSeleccion({
      materialId: id,
      materialNombre: mat.nombre,
      precioBase: getPrecioMaterial(mat, precioTipo),
      precioMayorista: mat?.precio_mayor_m2 != null ? Number(mat?.precio_mayor_m2 || 0) : 0,
      usarMayorista: false,
      loteId: '',
      loteCodigo: '',
      batchId: '',
      stockDisponible: 0,
      unidad: mat.unidad || 'm²',
      cantidad: 1
    });

    // Resetear diseño al cambiar material
    setPlanoData({
      placements: [],
      features: [],
      primitives: [],
      boardConfig: { width: 300, height: 180 },
      areaUtilizada: 0,
    });

    // 2. Limpiamos la lista de lotes visualmente mientras carga
    setLotesDisponibles([]);

    try {
      // 3. Buscamos el stock detallado de ESTE material en la API
      const resStock = await get(`/api/inventario/stock-detallado?material_id=${id}`);

      if (Array.isArray(resStock)) {
        setLotesDisponibles(resStock);
      }

      // 4. Si el material tiene medidas estándar, ajustamos el tablero
      if (mat.ancho_m && mat.largo_m) {
        setPlanoData(prev => ({
          ...prev,
          boardConfig: { width: mat.ancho_m * 100, height: mat.largo_m * 100 }
        }));
      }

      return Array.isArray(resStock) ? resStock : [];
    } catch (e) {
      toast.error("Error cargando lotes del material");
      return [];
    }
  };

  useEffect(() => {
    const id = seleccion.materialId;
    if (!id || id === '__manual__' || id === '__sin_material__' || id.startsWith('prod:')) return;
    const mat = materialesList.find(m => m.id === id);
    if (!mat) return;
    const nextPrecio = getPrecioMaterial(mat, precioTipo);
    setSeleccion(prev => (prev.precioBase === nextPrecio ? prev : { ...prev, precioBase: nextPrecio }));
  }, [precioTipo, seleccion.materialId, materialesList]);

  const seleccionarLote = (id: string) => {
    const item = lotesDisponibles.find(l => l.id === id);
    if (item) {
      const areaM2 = (item.ancho * item.largo) / 10000;

      // Determinar el precio a usar (se puede usar precio_venta del lote o caer al precio del material)
      const precioVenta = item.precio_venta || seleccion.precioBase;
      const precioMayorista = item.precio_mayorista || precioVenta;

      setSeleccion(prev => ({
        ...prev,
        loteId: id,
        loteCodigo: `${item.codigo_lote} (${item.tipo === 'retazo' ? 'Retazo' : 'Plancha'})`,
        batchId: item.lote_id,
        precioBase: precioVenta,
        precioMayorista: precioMayorista,
        usarMayorista: false,  // Por defecto usar precio público
        stockDisponible: areaM2,
        unidad: 'm²'
      }));

      // Ajustar tablero a las medidas reales de la pieza y RESETEAR diseño
      setPlanoData({
        placements: [],
        features: [],
        primitives: [],
        boardConfig: { width: item.ancho, height: item.largo },
        areaUtilizada: 0
      });
    }
  };

  const generarPacking = (boardW: number, boardH: number, primitives: any[]) => {
    const piezas: Array<{ w: number; h: number }> = [];
    for (const prim of primitives || []) {
      const ps = prim.piezas || [];
      for (const p of ps) {
        const w = Number(p.w_cm || 0);
        const h = Number(p.h_cm || 0);
        const qty = Math.max(1, Number(p.qty || 1));
        for (let i = 0; i < qty; i++) piezas.push({ w, h });
      }
    }
    // Ordenar por lado mayor para mejorar el empaquetado (heurística simple)
    piezas.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));
    const placements: Array<{ x: number; y: number; w: number; h: number }> = [];
    let x = 0, y = 0, shelfH = 0;
    let usedArea = 0;
    for (const rect of piezas) {
      let w = rect.w, h = rect.h;
      const tryPlace = (rw: number, rh: number) => {
        if (rw <= boardW && rh <= boardH) {
          if (x + rw <= boardW && y + rh <= boardH) {
            placements.push({ x, y, w: rw, h: rh });
            x += rw;
            shelfH = Math.max(shelfH, rh);
            usedArea += rw * rh;
            return true;
          }
          // nueva estantería
          if (y + shelfH + rh <= boardH) {
            y += shelfH;
            x = 0;
            shelfH = 0;
            if (rw <= boardW && rh <= boardH) {
              placements.push({ x, y, w: rw, h: rh });
              x += rw;
              shelfH = Math.max(shelfH, rh);
              usedArea += rw * rh;
              return true;
            }
          }
        }
        return false;
      };
      if (!tryPlace(w, h)) {
        // Intentar rotación si ayuda
        if (!tryPlace(h, w)) {
          // No cabe en esta placa; lo omitimos para esta vista (se irá a otra placa al agregar item)
        }
      }
    }
    return { placements, usedArea };
  };

  const actualizarDiseño = (placements: any[], areaM2: number, features: any[], primitives?: any[]) => {
    setPlanoData(prev => {
      const prim = primitives || prev.primitives || [];
      const bw = prev.boardConfig.width;
      const bh = prev.boardConfig.height;
      const packed = prim.length > 0 ? generarPacking(bw, bh, prim) : { placements, usedArea: (areaM2 || 0) * 10000 };
      const newAreaM2 = Math.max(areaM2 || 0, packed.usedArea / 10000.0);
      return { ...prev, placements: prim.length > 0 ? packed.placements : placements, features, areaUtilizada: newAreaM2, primitives: prim };
    });
  };

  const actualizarDimensionesTablero = (width: number, height: number) => {
    setPlanoData(prev => ({
      ...prev,
      boardConfig: { width, height }
    }));
  };

  const setCantidadSeleccion = (cantidad: number) => {
    setSeleccion(prev => ({
      ...prev,
      cantidad
    }));
  };

  const toggleUsarMayorista = (usarMayorista: boolean) => {
    setSeleccion(prev => ({
      ...prev,
      usarMayorista,
      precioBase: usarMayorista ? prev.precioMayorista : prev.precioBase
    }));
  };

  const seleccionarProducto = (producto: { id: string; nombre: string; precio_venta?: number; unidad?: string }) => {
    const precio = Number(producto?.precio_venta || 0);
    const unidad = producto?.unidad || 'unidad';
    setSeleccion({
      materialId: `prod:${producto.id}`,
      materialNombre: producto.nombre,
      loteId: '',
      loteCodigo: '',
      batchId: '',
      precioBase: precio,
      precioMayorista: 0,
      usarMayorista: false,
      stockDisponible: 0,
      unidad,
      cantidad: 1
    });
    setLotesDisponibles([]);
    setPlanoData({
      placements: [],
      features: [],
      primitives: [],
      boardConfig: { width: 300, height: 180 },
      areaUtilizada: 0,
    });
  };

  const resetMaterialAndPlan = () => {
    setSeleccion({
      materialId: '',
      materialNombre: '',
      loteId: '',
      loteCodigo: '',
      batchId: '',
      precioBase: 0,
      precioMayorista: 0,
      usarMayorista: false,
      stockDisponible: 0,
      unidad: 'm²',
      cantidad: 1
    });
    setLotesDisponibles([]);
    setPlanoData({
      placements: [],
      features: [],
      primitives: [],
      boardConfig: { width: 300, height: 180 },
      areaUtilizada: 0,
    });
  };

  const resetPresupuesto = () => {
    setCliente('');
    setFormCliente({
      nombre: '',
      email: '',
      telefono: '',
      direccion: '',
      coordenadas: '',
      place_id: '',
      lat: undefined,
      lng: undefined,
    });
    resetMaterialAndPlan();
    setItems([]);
    setExtras([]);
    setCurrentLeadId(null);
    limpiarPersistencia();
  };

  const agregarItem = () => {
    if (seleccion.unidad && seleccion.unidad !== 'm²') {
      const qty = Number(seleccion.cantidad || 0);
      if (!seleccion.materialId || qty <= 0) {
        toast.error("El ítem actual no está completo (Material o Cantidad faltante)");
        return;
      }

      const timestamp = Date.now().toString();
      const newItem = {
        id: `${timestamp}-u`,
        seleccion: { ...seleccion, cantidad: qty },
        planoData: {
          placements: [],
          features: [],
          primitives: [],
          boardConfig: { width: 300, height: 180 },
          areaUtilizada: qty,
        }
      };

      setItems(prev => [...prev, newItem]);
      toast.success("Ítem agregado");

      setPlanoData({
        placements: [],
        features: [],
        primitives: [],
        boardConfig: { width: 300, height: 180 },
        areaUtilizada: 0,
      });

      setSeleccion(prev => ({ ...prev, cantidad: 1 }));
      return;
    }

    // Validación más flexible: Permite si hay material y área, O si hay diseño manual aunque sea 0 area (raro pero posible en flujo)
    // Pero la regla es: Material + Diseño.
    if (!seleccion.materialId || planoData.areaUtilizada <= 0) {
      toast.error("El ítem actual no está completo (Material o Diseño faltante)");
      return;
    }
    // Estimar área total de piezas manuales (si existen) para auto-dividir en placas
    const calcPiecesAreaM2 = () => {
      let area = 0;
      if (planoData.primitives && planoData.primitives.length > 0) {
        for (const prim of planoData.primitives as any[]) {
          const piezas = prim.piezas || [];
          for (const p of piezas) {
            const w = Number(p.w_cm || 0);
            const h = Number(p.h_cm || 0);
            const qty = Math.max(1, Number(p.qty || 1));
            area += (w * h * qty) / 10000.0;
          }
        }
      }
      return area;
    };

    const boardAreaM2 = (planoData.boardConfig.width * planoData.boardConfig.height) / 10000.0;
    const piecesAreaM2 = calcPiecesAreaM2();
    const effectiveAreaM2 = piecesAreaM2 > 0 ? piecesAreaM2 : planoData.areaUtilizada;
    const boardsNeeded = Math.max(1, Math.ceil(effectiveAreaM2 / Math.max(0.0001, boardAreaM2)));

    const timestamp = Date.now().toString();
    const newItems = [];
    for (let i = 0; i < boardsNeeded; i++) {
      newItems.push({
        id: `${timestamp}-${i}`,
        seleccion: { ...seleccion },
        planoData: JSON.parse(JSON.stringify(planoData)),
      });
    }

    setItems(prev => [...prev, ...newItems]);

    toast.success(boardsNeeded > 1 ? `Se crearon ${boardsNeeded} placas automáticamente` : "Ítem agregado");

    // Reset de diseño, manteniendo material
    setPlanoData({
      placements: [],
      features: [],
      primitives: [],
      boardConfig: planoData.boardConfig,
      areaUtilizada: 0,
    });

    // También reseteamos el lote específico si es necesario, o lo mantenemos si es la misma plancha?
    // El usuario dice "es del mismo marmol solo que son piezas diferentes".
    // Asumimos que quiere seguir cortando del mismo material.
    // Mantenemos seleccion.materialId y seleccion.materialNombre.
    // Pero quizás quiera otro lote? O el mismo?
    // Por defecto mantenemos todo, el usuario puede cambiar lote en el UI si quiere.

    toast.success("Ítem agregado. Puede seguir cotizando con el mismo material o cambiarlo.");
  };

  const agregarItemManual = (
    areaM2: number,
    piezas: Array<{ w_cm: number; h_cm: number; qty: number; label?: string }>
  ): boolean => {
    if (!seleccion.materialId || areaM2 <= 0) {
      toast.error("Seleccione un material y agregue al menos una pieza válida");
      return false;
    }
    const timestamp = Date.now().toString();
    const newItem = {
      id: `${timestamp}-manual`,
      seleccion: { ...seleccion },
      planoData: {
        placements: [],
        features: [],
        primitives: [{ piezas }],
        boardConfig: { width: 300, height: 180 },
        areaUtilizada: areaM2,
      },
    };
    setItems(prev => [...prev, newItem]);
    toast.success("Ítem agregado al presupuesto");
    setPlanoData({
      placements: [],
      features: [],
      primitives: [],
      boardConfig: { width: 300, height: 180 },
      areaUtilizada: 0,
    });
    return true;
  };

  const eliminarItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const editarItem = async (index: number) => {
    const item = items[index];
    if (!item) return false;

    setItems(prev => prev.filter((_, i) => i !== index));

    if (item.seleccion?.materialId === '__manual__') {
      setSeleccion({
        ...item.seleccion,
        materialNombre: item.seleccion.materialNombre || 'Material Manual'
      });
      setLotesDisponibles([]);
    } else if (item.seleccion?.materialId) {
      const mat = materialesList.find(m => m.id === item.seleccion.materialId);
      setSeleccion({
        ...item.seleccion,
        materialNombre: mat?.nombre || item.seleccion.materialNombre
      });
      try {
        const resStock = await get(`/api/inventario/stock-detallado?material_id=${item.seleccion.materialId}`);
        setLotesDisponibles(Array.isArray(resStock) ? resStock : []);
      } catch (e) {
        setLotesDisponibles([]);
      }
    }

    setPlanoData(JSON.parse(JSON.stringify(item.planoData)));
    return true;
  };

  const limpiarItems = () => {
    setItems([]);
  };

  const calcularTotal = () => {
    const totalItems = items.reduce((acc, item) => {
      const unitQty = item.seleccion?.unidad && item.seleccion.unidad !== 'm²'
        ? Number(item.seleccion.cantidad || 0)
        : Number(item.planoData.areaUtilizada || 0);
      return acc + (item.seleccion.precioBase * unitQty);
    }, 0);
    const currentUnitQty = seleccion.unidad && seleccion.unidad !== 'm²'
      ? Number(seleccion.cantidad || 0)
      : Number(planoData.areaUtilizada || 0);
    const currentTotal = seleccion.precioBase * currentUnitQty;
    const totalExtras = extras.reduce((acc, extra) => acc + (extra.precio * extra.cantidad), 0);
    return totalItems + currentTotal + totalExtras;
  };

  const registrarNuevoCliente = async (datos?: any) => {
    const dataToSend = datos || formCliente;
    try {
      // 1. Evitar duplicados: Buscar si ya existe un lead o cliente con este nombre/teléfono
      const normalizar = (s: string) => s?.toLowerCase().trim() || "";
      const nombreNorm = normalizar(dataToSend.nombre);
      const telNorm = normalizar(dataToSend.telefono);

      const coincidencia = clientesList.find(c => {
        const cNombre = normalizar(c.nombre);
        const cTel = normalizar(c.telefono);
        return (nombreNorm && cNombre === nombreNorm) || (telNorm && telNorm.length > 5 && cTel === telNorm);
      });

      if (coincidencia) {
        console.log("Coincidencia encontrada:", coincidencia);
        toast.warning("Ya existe un cliente o lead con este nombre o teléfono. Por favor, modifique los datos o seleccione el existente.");
        return null;
      }

      // Lead: se crea/vincula solo en backend al primer POST /api/presupuestos (Sprint 3A).

      // Registrar el cliente (solo datos de contacto; obra va aparte en el presupuesto)
      const nuevoCliente = await post<any>('/api/clientes', {
        nombre: dataToSend.nombre,
        telefono: dataToSend.telefono || undefined,
        email: dataToSend.email || undefined,
      });
      setClientesList(prev => [...prev, nuevoCliente]);
      setCliente(nuevoCliente.id);
      toast.success("Cliente registrado correctamente");
      return nuevoCliente;
    } catch (e) {
      console.error("Error al registrar el cliente:", e);
      toast.error("Error al registrar el cliente");
      return null;
    }
  };

  const guardarEdicionCliente = async () => {
    if (!cliente || cliente === 'nuevo') {
      toast.error('Seleccione un cliente existente');
      return false;
    }
    try {
      await patch(`/api/clientes/${cliente}`, {
        nombre: formCliente.nombre,
        telefono: formCliente.telefono,
        email: formCliente.email,
      });
      setClientesList((prev) =>
        prev.map((c: any) =>
          c.id === cliente
            ? { ...c, nombre: formCliente.nombre, telefono: formCliente.telefono, email: formCliente.email }
            : c,
        ),
      );
      toast.success('Cliente actualizado');
      return true;
    } catch (e) {
      console.error(e);
      toast.error('No se pudo actualizar el cliente');
      return false;
    }
  };

  // --- LÓGICA DE GUARDADO (Presupuesto + Lead + Plano) ---
  const guardarPresupuestoYLead = async (anexosImagenes: string[] = []) => {
    // Validar: Debe haber cliente Y (al menos un item en lista O item actual válido)
    const hasCurrent = seleccion.materialId && (seleccion.unidad !== 'm²' ? Number(seleccion.cantidad || 0) > 0 : planoData.areaUtilizada > 0);
    const hasItems = items.length > 0;

    if (!cliente || (!hasCurrent && !hasItems)) {
      toast.error("Faltan datos (Cliente, Material o Dibujo)");
      return false;
    }

    const total = calcularTotal();
    if (total <= 0) {
      toast.error("El total del presupuesto debe ser mayor a 0");
      return false;
    }
    let clienteId = cliente;
    let clienteData: any = clientesList.find(c => c.id === cliente);

    const placeIdYLead = String((clienteData as any)?.place_id || formCliente.place_id || '').trim();
    let latNYLead = typeof formCliente.lat === 'number' ? formCliente.lat : NaN;
    let lngNYLead = typeof formCliente.lng === 'number' ? formCliente.lng : NaN;
    if (!Number.isFinite(latNYLead) || !Number.isFinite(lngNYLead)) {
      const raw = String(clienteData?.coordenadas || formCliente.coordenadas || '');
      const parts = raw.split(',').map((s: string) => parseFloat(s.trim()));
      latNYLead = parts[0];
      lngNYLead = parts[1];
    }
    const hasGeoYLead = Number.isFinite(latNYLead) && Number.isFinite(lngNYLead);
    if ((paymentInfo.descuento?.valor || 0) > 0 && !paymentInfo.descuento?.catalogoId) {
      toast.error('Seleccione un descuento del catálogo.');
      return false;
    }

    try {
      // Preparar 1 sola línea consolidada por presupuesto
      // Calcular totales consolidados
      let totalMetrosCuadrados = 0;
      let totalPrecio = 0;
      let materialPrincipal = seleccion.materialNombre || 'Varios';
      let loteIdPrincipal = seleccion.loteId || null;

      // Sumar items previos
      for (const item of items) {
        const itemQty = item.seleccion?.unidad && item.seleccion.unidad !== 'm²'
          ? Number(item.seleccion.cantidad || 0)
          : Number(item.planoData.areaUtilizada || 0);
        totalMetrosCuadrados += itemQty;
        totalPrecio += Number(item.seleccion.precioBase || 0) * itemQty;
      }

      // Sumar item actual
      if (hasCurrent) {
        const currentQty = seleccion.unidad !== 'm²'
          ? Number(seleccion.cantidad || 0)
          : Number(planoData.areaUtilizada || 0);
        totalMetrosCuadrados += currentQty;
        totalPrecio += Number(seleccion.precioBase || 0) * currentQty;
      }

      // Crear 1 sola línea consolidada
      const singleLine = {
        material: materialPrincipal,
        metros_cuadrados: Number(totalMetrosCuadrados),
        precio_unitario: totalMetrosCuadrados > 0 ? Number(totalPrecio / totalMetrosCuadrados) : 0,
        lote_id: loteIdPrincipal,
        geometria_json: JSON.stringify(planoData)
      };

      const payloadPresupuesto = {
        cliente_id: clienteId,
        direccion_obra_texto: clienteData?.direccion || formCliente.direccion || undefined,
        lat: hasGeoYLead ? latNYLead : undefined,
        lng: hasGeoYLead ? lngNYLead : undefined,
        place_id: placeIdYLead || undefined,
        coordenadas: hasGeoYLead
          ? String(formCliente.coordenadas || '').trim() || `${latNYLead}, ${lngNYLead}`
          : String(formCliente.coordenadas || '').trim() || undefined,
        lineas: [singleLine],
        items_adicionales: extras.map(e => ({
          nombre: e.nombre,
          precio: e.precio,
          cantidad: e.cantidad,
          categoria: e.categoria || 'otro'
        })),
        tipo_cobro: paymentInfo.tipoCobro,
        con_factura: paymentInfo.conFactura,
        iva_tasa: 0.21,
        plazo_pago_catalogo_id: paymentInfo.plazoPagoCatalogoId || undefined,
        condiciones_pago_texto: paymentInfo.condicionesPagoTexto.trim() || undefined,
        descuento_id: paymentInfo.descuento?.catalogoId || undefined,
        descuento_tipo: paymentInfo.descuento?.tipo || 'fijo',
        descuento_valor: Number(paymentInfo.descuento?.catalogoId ? 0 : (paymentInfo.descuento?.valor || 0)),
        observaciones: `Generado desde Cotizador. Total: $${calcularTotal().toLocaleString()}`,
        anexosImagenes: anexosImagenes
      };
      const presupuestoRes = await post<any>('/api/presupuestos', payloadPresupuesto);
      setUltimoPresupuesto(presupuestoRes || null);

      // Guardar un único plano técnico consolidado con todos los items
      if (presupuestoRes?.id) {
        const todosLosPlacements: any[] = [];
        const todasLasFeatures: any[] = [];

        // Agregar placements de items guardados
        for (const item of items) {
          todosLosPlacements.push(...(item.planoData.placements || []));
          todasLasFeatures.push(...(item.planoData.features || []));
        }

        // Agregar el actual si existe
        if (hasCurrent) {
          todosLosPlacements.push(...(planoData.placements || []));
          todasLasFeatures.push(...(planoData.features || []));
        }

        // Solo guardar plano si hay contenido
        if (todosLosPlacements.length > 0) {
          const planoConsolidado = {
            effective_board: {
              width: planoData.boardConfig?.width || 300,
              height: planoData.boardConfig?.height || 180
            },
            placements: todosLosPlacements,
            features: todasLasFeatures,
            material: { nombre: seleccion.materialNombre || 'Varios' }
          };

          await post('/api/planos-tecnicos', {
            nombre: `Plano Consolidado - ${clienteData?.nombre || 'Cliente'}`,
            cliente_id: clienteId,
            proyecto: `Presupuesto ${presupuestoRes.id}`,
            presupuesto_id: presupuestoRes.id,
            categoria: "Corte",
            estado: "borrador",
            tipo: "automatico",
            contenido_json: JSON.stringify(planoConsolidado)
          });
        }
      }

      limpiarPersistencia();
      toast.success("Presupuesto guardado correctamente");
      return true;
    } catch (e) {
      console.error("Error al guardar:", e);
      toast.error("Error al guardar el flujo completo");
      return false;
    }
  };

  /**
   * Guardado multi-línea (ambientes → piezas → extras) + productos adicionales en meta.
   * @returns id del presupuesto guardado o `false` si falla.
   */
  const guardarPresupuestoConstructor = async (args: {
    ambientes: AmbientePresupuesto[];
    productosAdicionales: ProductoAdicionalLinea[];
    anexosImagenes?: string[];
    /** Si se edita un presupuesto abierto por URL, actualiza en lugar de crear otro */
    presupuestoIdEdicion?: string | null;
  }) => {
    const lineas = lineasApiDesdeAmbientes(args.ambientes);
    if (!cliente) {
      toast.error('Seleccione un cliente');
      return false;
    }
    const clienteId = cliente;
    const uo = ubicacionObra;
    const placeIdObra = String(uo.place_id || '').trim();
    let latN = typeof uo.lat === 'number' ? uo.lat : NaN;
    let lngN = typeof uo.lng === 'number' ? uo.lng : NaN;
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
      const raw = String(uo.coordenadas || '');
      const parts = raw.split(',').map((s: string) => parseFloat(s.trim()));
      latN = parts[0];
      lngN = parts[1];
    }
    const hasGeoObra = Number.isFinite(latN) && Number.isFinite(lngN);
    if ((paymentInfo.descuento?.valor || 0) > 0 && !paymentInfo.descuento?.catalogoId) {
      toast.error('Seleccione un descuento del catálogo.');
      return false;
    }

    const subMat = args.ambientes.reduce((acc, amb) => {
      let a = acc;
      for (const p of amb.piezas) {
        a += subtotalMaterialPieza(p);
        for (const ex of p.extras) a += ex.precio * ex.cantidad;
      }
      return a;
    }, 0);
    const subProd = args.productosAdicionales.reduce((s, x) => s + x.precio * x.cantidad, 0);
    const bruto = subMat + subProd;
    if (bruto <= 0) {
      toast.error('El total del presupuesto debe ser mayor a 0');
      return false;
    }

    const items_adicionales = args.productosAdicionales.map(e => ({
      nombre: e.nombre,
      precio: e.precio,
      cantidad: e.cantidad,
      categoria: 'adicional',
      producto_id: e.producto_id,
    }));

    const ambientesMeta = args.ambientes.map(a => ({
      id: a.id,
      nombre: a.nombre,
      piezas: a.piezas.map(p => ({
        id: p.id,
        material_id: p.material_id,
        material_nombre: p.material_nombre,
        precio_m2: p.precio_m2,
        m2: p.m2,
        largo_m: p.largo_m,
        ancho_m: p.ancho_m,
        cantidad_piezas: p.cantidad_piezas ?? 1,
        medidas: p.medidas,
        lote_id: p.lote_id,
        extras: p.extras.map(e => ({
          id: e.id,
          servicio_id: e.servicio_id,
          nombre: e.nombre,
          precio: e.precio,
          cantidad: e.cantidad,
        })),
      })),
    }));

    try {
      const coordPayload = hasGeoObra
        ? String(uo.coordenadas || '').trim() || `${latN}, ${lngN}`
        : String(uo.coordenadas || '').trim() || undefined;
      const payloadPresupuesto = {
        cliente_id: clienteId,
        direccion_obra_texto: String(uo.direccion || '').trim() || undefined,
        lat: hasGeoObra ? latN : undefined,
        lng: hasGeoObra ? lngN : undefined,
        place_id: placeIdObra || undefined,
        coordenadas: coordPayload,
        lineas,
        items_adicionales,
        tipo_cobro: paymentInfo.tipoCobro,
        con_factura: false,
        iva_tasa: 0.21,
        plazo_pago_catalogo_id: paymentInfo.plazoPagoCatalogoId || undefined,
        condiciones_pago_texto: paymentInfo.condicionesPagoTexto.trim() || undefined,
        descuento_id: paymentInfo.descuento?.catalogoId || undefined,
        descuento_tipo: paymentInfo.descuento?.tipo || 'fijo',
        descuento_valor: Number(paymentInfo.descuento?.catalogoId ? 0 : (paymentInfo.descuento?.valor || 0)),
        observaciones: `Presupuesto constructor (ambientes). Neto ítems: $${bruto.toLocaleString('es-AR')}`,
        anexosImagenes: args.anexosImagenes || [],
      };
      const editId = args.presupuestoIdEdicion?.trim();
      const presupuestoRes = editId
        ? await put<any>(`/api/presupuestos/${editId}`, payloadPresupuesto)
        : await post<any>('/api/presupuestos', payloadPresupuesto);
      setUltimoPresupuesto(
        presupuestoRes?.id
          ? presupuestoRes
          : editId
            ? { ...presupuestoRes, id: editId }
            : presupuestoRes,
      );

      const presupuestoSavedId = presupuestoRes?.id || editId;
      if (presupuestoSavedId) {
        try {
          const currentMeta = await get<Record<string, unknown> | null>(
            `/api/presupuestos/${presupuestoSavedId}/meta`,
          ).catch(() => null);
          const base =
            currentMeta != null &&
            typeof currentMeta === 'object' &&
            !Array.isArray(currentMeta)
              ? { ...currentMeta }
              : {};
          await post(`/api/presupuestos/${presupuestoSavedId}/meta`, {
            data: {
              ...base,
              ambientes: ambientesMeta,
              plazo_pago_catalogo_id: paymentInfo.plazoPagoCatalogoId || undefined,
              observaciones_acceso_obra: String(uo.observaciones_acceso || '').trim() || undefined,
            },
          });
        } catch (e) {
          console.warn('No se pudo guardar meta.ambientes', e);
        }
      }

      limpiarPersistencia();
      toast.success(editId ? 'Presupuesto actualizado' : 'Presupuesto guardado correctamente');
      return typeof presupuestoSavedId === 'string' && presupuestoSavedId ? presupuestoSavedId : false;
    } catch (e) {
      console.error('Error al guardar constructor:', e);
      toast.error('Error al guardar el presupuesto');
      return false;
    }
  };

  return {
    clientesList,
    materialesList,
    lotesDisponibles,
    cliente,
    setCliente,
    formCliente,
    setFormCliente,
    ubicacionObra,
    setUbicacionObra,
    seleccion,
    precioTipo,
    setPrecioTipo,
    seleccionarMaterial,
    seleccionarLote,
    toggleUsarMayorista,
    planoData,
    actualizarDiseño,
    calcularTotal,
    extras,
    setExtras,
    paymentInfo,
    setPaymentInfo,
    ultimoPresupuesto,
    registrarNuevoCliente,
    guardarEdicionCliente,
    guardarPresupuestoYLead,
    guardarPresupuestoConstructor,
    clearPendingBudgetLoad,
    limpiarPersistencia,
    limpiarTodo,
    resetPresupuesto,
    items,
    agregarItem,
    agregarItemManual,
    eliminarItem,
    editarItem,
    limpiarItems,
    resetMaterialAndPlan,
    actualizarDimensionesTablero,
    setCantidadSeleccion,
    seleccionarProducto
  };
}
