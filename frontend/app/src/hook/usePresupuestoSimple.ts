import { useState, useEffect } from 'react';
import { get, post, patch } from '../api'; // Tu cliente API
import { toast } from 'sonner';

interface PresupuestoResponse {
  id: string;
  cliente_id: string;
  lineas: Array<{
    tipo?: 'material' | 'articulo' | 'accesorio' | 'extra';
    material: string;
    material_id?: string;
    producto_id?: string;
    accesorio_id?: string;
    unidad?: string;
    cantidad?: number;
    lote_id?: string;
    geometria_json?: string;
    planos_manual_json?: any;
    metros_cuadrados: number;
    precio_unitario: number;
  }>;
  meta?: {
    items_adicionales?: any[];
    tipo_cobro?: string;
    con_factura?: boolean;
    descuento_tipo?: 'fijo' | 'porcentaje';
    descuento_valor?: number;
  };
  total: number;
  observaciones?: string;
}

export function usePresupuestoSimple() {
  // Datos Maestros
  const [clientesList, setClientesList] = useState<any[]>([]);
  const [materialesList, setMaterialesList] = useState<any[]>([]);
  const [articulosList, setArticulosList] = useState<any[]>([]);
  const [loadingArticulos, setLoadingArticulos] = useState<boolean>(false);
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null);

  // Estado de Selección
  const [cliente, setCliente] = useState<string>('');

  const [formCliente, setFormCliente] = useState({
    nombre: '',
    email: '',
    telefono: '',
    direccion: '',
    coordenadas: ''
  });

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
    descuento: { tipo: 'fijo' | 'porcentaje'; valor: number };
  }>({
    tipoCobro: 'contado',
    conFactura: false,
    descuento: {
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

          // Lineas tipadas (Material, Artículo, Accesorio, Extra)
          if (data.lineas && data.lineas.length > 0) {
            const loadedItems: any[] = [];
            const loadedExtras: any[] = [];
            for (const linea of data.lineas) {
              const tipo = linea.tipo || 'material';
              if (tipo === 'extra') {
                loadedExtras.push({
                  id: Date.now().toString() + Math.random(),
                  descripcion: linea.material,
                  cantidad: Number(linea.cantidad || 1),
                  precio: Number(linea.precio_unitario || 0),
                });
                continue;
              }

              const matName = linea.material;
              const mat = materialesList.find(m => m.nombre === matName);
              // Si no encontramos el material en la lista actual, usamos datos genéricos

              const isUnit = (linea.unidad || mat?.unidad || 'm²') !== 'm²';
              let selectedId = mat ? mat.id : '';
              if (tipo === 'articulo' && linea.producto_id) selectedId = `prod:${linea.producto_id}`;
              if (tipo === 'accesorio' && linea.accesorio_id) selectedId = `acc:${linea.accesorio_id}`;

              const newItem: any = {
                id: Date.now().toString() + Math.random(),
                seleccion: {
                  materialId: selectedId,
                  materialNombre: matName,
                  loteId: linea.lote_id || '',
                  loteCodigo: linea.lote_id ? 'Lote Cargado' : '',
                  batchId: linea.lote_id,
                  precioBase: linea.precio_unitario,
                  stockDisponible: 0,
                  unidad: linea.unidad || mat?.unidad || 'm²',
                  cantidad: Number(linea.cantidad || 1)
                },
                planoData: {
                  placements: [],
                  features: [],
                  primitives: [],
                  boardConfig: { width: 300, height: 180 },
                  areaUtilizada: isUnit ? Number(linea.cantidad || linea.metros_cuadrados || 0) : Number(linea.metros_cuadrados || 0),
                }
              };

              if (linea.geometria_json && tipo === 'material') {
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
            if (loadedExtras.length > 0) {
              setExtras(loadedExtras);
            }
            // Si hay items, dejamos el editor limpio para agregar uno nuevo
            // Opcional: Podríamos cargar el último en el editor si quisieramos
          }

          // Extras y Pago
          if (data.meta) {
            if (data.meta.items_adicionales) {
              setExtras(prev => prev.length > 0 ? prev : data.meta?.items_adicionales || []);
            }
            const descuentoMeta = (data.meta as any)?.descuento;
            const descuentoTipo = descuentoMeta?.tipo === 'porcentaje' ? 'porcentaje' : 'fijo';
            setPaymentInfo({
              tipoCobro: data.meta.tipo_cobro || 'contado',
              conFactura: data.meta.con_factura || false,
              descuento: {
                tipo: (data.meta.descuento_tipo || descuentoTipo) as 'fijo' | 'porcentaje',
                valor: Number(data.meta.descuento_valor ?? descuentoMeta?.valor ?? 0)
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
  }, [cliente, formCliente, seleccion, lotesDisponibles, extras, paymentInfo, planoData, currentLeadId]);

  const limpiarPersistencia = () => {
    localStorage.removeItem('PRESUPUESTO_TEMP_STATE');
  };

  const limpiarTodo = () => {
    console.log("Limpiando todo el estado del presupuesto...");
    setCliente('');
    setFormCliente({
      nombre: '',
      email: '',
      telefono: '',
      direccion: '',
      coordenadas: ''
    });
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
      descuento: { tipo: 'fijo', valor: 0 }
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
  };

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

        setLoadingArticulos(true);
        try {
          const articulos = await get<any[]>('/api/articulos');
          setArticulosList(Array.isArray(articulos) ? articulos : []);
        } catch (err) {
          console.warn('No se pudieron cargar artículos', err);
          setArticulosList([]);
        } finally {
          setLoadingArticulos(false);
        }
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
          direccion: selected.direccion || '',
          coordenadas: selected.coordenadas || ''
        });
      }
    } else if (cliente === 'nuevo') {
      setFormCliente({
        nombre: '',
        email: '',
        telefono: '',
        direccion: '',
        coordenadas: ''
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

  const seleccionarArticulo = (articulo: { id: string; nombre: string; precio_unitario?: number; unidad?: string }) => {
    const precio = Number(articulo?.precio_unitario || 0);
    const unidad = articulo?.unidad || 'u';
    setSeleccion({
      materialId: `prod:${articulo.id}`,
      materialNombre: articulo.nombre,
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

  const seleccionarAccesorio = (accesorio: { id: string; nombre: string; precio_unitario?: number; unidad?: string }) => {
    const precio = Number(accesorio?.precio_unitario || 0);
    const unidad = accesorio?.unidad || 'u';
    setSeleccion({
      materialId: `acc:${accesorio.id}`,
      materialNombre: accesorio.nombre,
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

  const toTypedLinea = (item: any) => {
    const seleccionItem = item?.seleccion || {};
    const planoItem = item?.planoData || {};
    const materialId = String(seleccionItem.materialId || '');
    const unidad = (seleccionItem.unidad || 'm²').toString();
    const isUnit = unidad !== 'm²';
    const qty = isUnit ? Number(seleccionItem.cantidad || 0) : Number(planoItem.areaUtilizada || 0);
    if (!materialId || qty <= 0) return null;

    const base: any = {
      material: seleccionItem.materialNombre || 'Ítem',
      material_id: null,
      producto_id: null,
      accesorio_id: null,
      unidad,
      cantidad: isUnit ? qty : null,
      metros_cuadrados: isUnit ? qty : qty,
      precio_unitario: Number(seleccionItem.precioBase || 0),
      lote_id: seleccionItem.loteId || null,
      geometria_json: null,
      planos_manual_json: null,
      tipo: 'material'
    };

    if (materialId.startsWith('prod:')) {
      base.tipo = 'articulo';
      base.producto_id = materialId.replace('prod:', '');
    } else if (materialId.startsWith('acc:')) {
      base.tipo = 'accesorio';
      base.accesorio_id = materialId.replace('acc:', '');
    } else if (materialId !== '__manual__' && materialId !== '__sin_material__') {
      base.material_id = materialId;
      base.geometria_json = planoItem ? JSON.stringify(planoItem) : null;
      base.planos_manual_json = Array.isArray(planoItem?.primitives) ? planoItem.primitives : null;
      base.tipo = 'material';
    }

    return base;
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
      coordenadas: ''
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

      // const coincidencia = null; // Forzamos a null para ignorar duplicados

      // 2. Si no hay coincidencia de Lead, creamos uno nuevo automáticamente en el pipeline
      if (!currentLeadId && !coincidencia?.leadId) {
        try {
          const payloadLead = {
            nombre: dataToSend.nombre,
            telefono: dataToSend.telefono,
            email: dataToSend.email,
            direccion: dataToSend.direccion,
            coordenadas: dataToSend.coordenadas,
            estado: 'recibir_posible',
            prioridad: 'media',
            origen: 'Cotizador Wizard (Auto)',
            comentario: "Lead creado automáticamente al registrar cliente."
          };
          const leadCreado = await post<any>('/api/leads', payloadLead);
          if (leadCreado && leadCreado.id) {
            setCurrentLeadId(leadCreado.id);
            console.log("Nuevo lead creado automáticamente:", leadCreado.id);
          }
        } catch (e) {
          console.warn("No se pudo crear el lead automáticamente, continuando con registro de cliente", e);
        }
      }

      // 3. Registrar el cliente
      const nuevoCliente = await post<any>('/api/clientes', dataToSend);
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

    // Eliminado soporte de IDs tipo 'lead:'; trabajamos solo con clientes

    try {
      const currentItem = hasCurrent
        ? [{
          id: 'current',
          seleccion: { ...seleccion },
          planoData: JSON.parse(JSON.stringify(planoData || {}))
        }]
        : [];

      const allItems = [...items, ...currentItem];
      const lineasTipadas = allItems
        .map(toTypedLinea)
        .filter((l): l is any => Boolean(l));

      const extrasLineas = extras
        .filter((e: any) => Number(e.cantidad || 0) > 0 && Number(e.precio || 0) >= 0)
        .map((e: any) => ({
          tipo: 'extra',
          material: e.descripcion || e.nombre || 'Extra',
          material_id: null,
          producto_id: null,
          accesorio_id: null,
          unidad: 'u',
          cantidad: Number(e.cantidad || 1),
          metros_cuadrados: 0,
          precio_unitario: Number(e.precio || 0),
          lote_id: null,
          geometria_json: null,
          planos_manual_json: null,
        }));

      const lineasPayload = [...lineasTipadas, ...extrasLineas];
      if (lineasPayload.length === 0) {
        toast.error('No hay líneas válidas para guardar');
        return false;
      }

      const payloadPresupuesto = {
        cliente_id: clienteId,
        coordenadas: clienteData?.coordenadas || null,
        lineas: lineasPayload,
        items_adicionales: extras.map(e => ({
          nombre: e.descripcion || e.nombre,
          descripcion: e.descripcion || e.nombre,
          precio: Number(e.precio || 0),
          cantidad: Number(e.cantidad || 1),
          categoria: e.categoria || 'otro'
        })),
        tipo_cobro: paymentInfo.tipoCobro,
        con_factura: true,
        iva_tasa: 0.21,
        descuento_tipo: paymentInfo.descuento?.tipo || 'fijo',
        descuento_valor: Number(paymentInfo.descuento?.valor || 0),
        observaciones: `Generado desde Cotizador. Líneas: ${lineasPayload.length}. Total: $${calcularTotal().toLocaleString()}`,
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

  return {
    clientesList,
    materialesList,
    articulosList,
    loadingArticulos,
    lotesDisponibles,
    cliente,
    setCliente,
    formCliente,
    setFormCliente,
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
    guardarPresupuestoYLead,
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
    seleccionarProducto,
    seleccionarArticulo,
    seleccionarAccesorio
  };
}
