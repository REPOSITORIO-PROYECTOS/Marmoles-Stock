import { describe, it, expect, vi } from 'vitest';

vi.mock('./planImage', () => ({
  generatePlanImage: vi.fn(() => ''),
}));

import { buildPresupuestoArgentinoHtml, type DatosPresupuesto } from './presupuestoExporter';
import {
  buildNombreArchivoPresupuestoComercial,
  condicionesComercialesHtmlDesdeMeta,
  medidasTextoDesdeLinea,
  parseMedidasDimensionMetros,
  pdfMedidaDesdeLinea,
  pdfResumenFinancieroDesdeMeta,
  presupuestoApiToDatosPresupuesto,
  sanitizeClienteNombreArchivo,
  type PresupuestoLineaApi,
} from './presupuestoRenderer';

describe('parseMedidasDimensionMetros', () => {
  it('interpreta cm y mm', () => {
    expect(parseMedidasDimensionMetros('300 x 150 cm')).toEqual({ largo_m: 3, ancho_m: 1.5 });
    expect(parseMedidasDimensionMetros('1000x500mm')).toEqual({ largo_m: 1, ancho_m: 0.5 });
  });

  it('interpreta metros sin confundir m²', () => {
    expect(parseMedidasDimensionMetros('1,00×0,60 m')).toEqual({ largo_m: 1, ancho_m: 0.6 });
    expect(parseMedidasDimensionMetros('2 piezas × 1,2 m² c/u')).toBeNull();
  });
});

describe('pdfMedidaDesdeLinea', () => {
  it('vacío en servicio / unidad', () => {
    expect(
      pdfMedidaDesdeLinea({
        tipo: 'servicio',
        material: 'Corte',
        unidad: 'unidad',
        cantidad: 1,
        metros_cuadrados: 0,
        precio_unitario: 1,
      }),
    ).toBe('');
  });

  it('usa geometría (primera pieza, cm → m)', () => {
    const geo = JSON.stringify({
      placements: [{ w: 100, h: 60 }],
    });
    expect(
      pdfMedidaDesdeLinea({
        tipo: 'material',
        material: 'M',
        unidad: 'm²',
        metros_cuadrados: 0.6,
        precio_unitario: 1,
        geometria_json: geo,
      }),
    ).toBe('1×0,6 m');
  });
});

describe('medidasTextoDesdeLinea', () => {
  it('usa el campo medidas del API cuando existe', () => {
    const linea: PresupuestoLineaApi = {
      medidas: '240 x 60 cm',
      metros_cuadrados: 1.5,
      unidad: 'm²',
      tipo: 'material',
    };
    expect(medidasTextoDesdeLinea(linea)).toBe('240 x 60 cm');
  });

  it('no usa placeholder genérico: deriva m² si falta medidas', () => {
    const linea: PresupuestoLineaApi = {
      metros_cuadrados: 2.25,
      unidad: 'm²',
      tipo: 'material',
    };
    expect(medidasTextoDesdeLinea(linea)).toBe('2.25 m²');
  });
});

describe('presupuestoApiToDatosPresupuesto', () => {
  it('mapea líneas con medidas reales en items del PDF', () => {
    const datos = presupuestoApiToDatosPresupuesto(
      {
        id: 'abc-123-def',
        total: 1000,
        lineas: [
          {
            tipo: 'material',
            material: 'Granito',
            medidas: '300 x 150 cm',
            metros_cuadrados: 4.5,
            unidad: 'm²',
            precio_unitario: 100,
            cortes_especiales: true,
            agujeros: 2,
          },
        ],
        meta: { correlativo_global: 5 },
      },
      {
        cliente: { nombre: 'Juan', direccion: 'X', telefono: '1' },
        fecha: '07/04/2026',
      },
    );

    expect(datos.items).toHaveLength(1);
    expect(datos.items[0].medidas).toBe('300 x 150 cm');
    expect(datos.items[0].detalle).toContain('Granito');
    expect(datos.items[0].cortes).toBe('2 agujeros');
    expect(datos.items[0].pdfEsMaterialM2).toBe(true);
    expect(datos.items[0].pdfCantidadPiezas).toBe(1);
    expect(datos.items[0].pdfMetrosCuadrados).toBe(4.5);
    expect(datos.items[0].pdfMedida).toBe('3×1,5 m');
    expect(datos.observaciones).toBe('');
  });

  it('no recalcula m² facturable desde L×W: m² y subtotal de línea salen del API', () => {
    const datos = presupuestoApiToDatosPresupuesto(
      {
        id: 'id-1',
        subtotal_neto: 500,
        iva_monto: 105,
        total_final: 605,
        lineas: [
          {
            tipo: 'material',
            material: 'Granito',
            medidas: '2 x 1 m',
            metros_cuadrados: 3.7,
            unidad: 'm²',
            precio_unitario: 100,
            recargo_extra: 0,
          },
        ],
        meta: {},
      },
      { cliente: { nombre: 'X', direccion: '', telefono: '' } },
    );
    expect(datos.items[0].pdfMetrosCuadrados).toBe(3.7);
    expect(datos.items[0].total).toBe(370);
    expect(datos.subtotalNeto).toBe(500);
    expect(datos.ivaMonto).toBe(105);
    expect(datos.totalFinal).toBe(605);
  });

  it('material m²: cantidad API = piezas distintas de m² totales (ej. 2 piezas, 2,40 m²)', () => {
    const datos = presupuestoApiToDatosPresupuesto(
      {
        id: 'id',
        total: 1,
        lineas: [
          {
            tipo: 'material',
            material: 'MARMOL NEGRO BRASIL',
            unidad: 'm²',
            metros_cuadrados: 2.4,
            cantidad: 2,
            precio_unitario: 180000,
            medidas: '2 piezas × 1,2 m² c/u (2,4 m² total)',
          },
        ],
        meta: {},
      },
      { cliente: { nombre: 'X', direccion: '', telefono: '' } },
    );
    expect(datos.items[0].pdfCantidadPiezas).toBe(2);
    expect(datos.items[0].pdfMetrosCuadrados).toBe(2.4);
    expect(datos.items[0].pdfMedida).toBe('');
  });

  it('material m²: sin cantidad en API, infiere piezas desde medidas del constructor', () => {
    const datos = presupuestoApiToDatosPresupuesto(
      {
        id: 'id',
        total: 1,
        lineas: [
          {
            tipo: 'material',
            material: 'MARMOL NEGRO BRASIL',
            unidad: 'm²',
            metros_cuadrados: 2.4,
            precio_unitario: 180000,
            medidas: '2 piezas × 1,2 m² c/u (2,4 m² total)',
          },
        ],
        meta: {},
      },
      { cliente: { nombre: 'X', direccion: '', telefono: '' } },
    );
    expect(datos.items[0].pdfCantidadPiezas).toBe(2);
  });

  it('ítem servicio: columna m² vacía en flags PDF', () => {
    const datos = presupuestoApiToDatosPresupuesto(
      {
        id: 'id',
        total: 70000,
        lineas: [
          {
            tipo: 'servicio',
            material: 'Corte de bacha',
            unidad: 'unidad',
            cantidad: 2,
            metros_cuadrados: 0,
            precio_unitario: 35000,
          },
        ],
        meta: {},
      },
      { cliente: { nombre: 'X', direccion: '', telefono: '' } },
    );
    expect(datos.items[0].pdfEsMaterialM2).toBe(false);
    expect(datos.items[0].pdfCantidadPiezas).toBe(2);
    expect(datos.items[0].pdfMetrosCuadrados).toBeNull();
  });

  it('expone resumen PDF con descuento coherente con meta', () => {
    const datos = presupuestoApiToDatosPresupuesto(
      {
        id: 'p1',
        codigo: 'P00001',
        lineas: [],
        subtotal_neto: 900,
        iva_monto: 189,
        total_final: 1089,
        meta: {
          subtotal_materiales: 1000,
          subtotal_extras: 0,
          subtotal_neto: 900,
          iva_monto: 189,
          total_final: 1089,
          descuento_tipo: 'porcentaje',
          descuento_valor: 10,
          descuento_catalogo: { nombre: 'Promo', tipo: 'porcentaje', valor: 10 },
        },
      },
      { cliente: { nombre: 'C', direccion: '', telefono: '' }, docId: 'P00001' },
    );
    expect(datos.subtotalBrutoPdf).toBe(1000);
    expect(datos.montoDescuentoPdf).toBe(100);
    expect(datos.subtotalNeto).toBe(900);
    expect(datos.leyendaDescuentoPdf).toContain('Promo');
  });

  it('expone IVA % de lectura desde meta.iva_tasa decimal', () => {
    const datos = presupuestoApiToDatosPresupuesto(
      {
        id: 'x',
        codigo: 'P00007',
        total: 1210,
        subtotal_neto: 1000,
        iva_monto: 210,
        total_final: 1210,
        lineas: [],
        meta: { iva_tasa: 0.21, subtotal_neto: 1000, iva_monto: 210, total_final: 1210 },
      },
      { cliente: { nombre: 'A', direccion: '', telefono: '' }, docId: 'P00007', fecha: '2026-04-07' },
    );
    expect(datos.ivaTasaDisplayPct).toBe(21);
    expect(datos.id).toBe('P00007');
    expect(datos.fecha).toBe('07/04/2026');
  });
});

describe('buildNombreArchivoPresupuestoComercial', () => {
  it('arma nombre comercial con código, cliente y fecha ISO', () => {
    expect(
      buildNombreArchivoPresupuestoComercial('P00001', 'García López', '2026-04-07'),
    ).toBe('P00001 - García López - 2026-04-07.pdf');
  });

  it('sin código lanza error', () => {
    expect(() => buildNombreArchivoPresupuestoComercial('', 'Cliente')).toThrow();
  });
});

describe('sanitizeClienteNombreArchivo', () => {
  it('elimina caracteres inválidos y conserva espacios simples', () => {
    expect(sanitizeClienteNombreArchivo('Juan: test')).toBe('Juan test');
  });
});

describe('condicionesComercialesHtmlDesdeMeta', () => {
  it('solo forma de pago: ignora texto de descuento en condiciones_comerciales', () => {
    const html = condicionesComercialesHtmlDesdeMeta({
      condiciones_comerciales: { plazo_pago: '30 días', descuento: 'Promo — 5%' },
    });
    expect(html).toContain('30 días');
    expect(html).toContain('Forma de pago');
    expect(html).not.toContain('Descuento aplicado');
    expect(html).not.toContain('Promo');
  });

  it('vacío si no hay plazo ni tipo_cobro ni texto usuario', () => {
    expect(condicionesComercialesHtmlDesdeMeta({})).toBe('');
  });

  it('solo texto usuario: muestra bloque sin forma de pago', () => {
    const html = condicionesComercialesHtmlDesdeMeta({
      condiciones_pago_texto_usuario: 'Seña 50% / saldo contra entrega.',
    });
    expect(html).toContain('Condiciones comerciales');
    expect(html).toContain('Seña 50%');
    expect(html).toContain('condiciones-comerciales-usuario');
    expect(html).not.toContain('Forma de pago');
  });

  it('plazo y texto usuario: ambos bloques', () => {
    const html = condicionesComercialesHtmlDesdeMeta({
      tipo_cobro: 'contado',
      condiciones_pago_texto_usuario: 'Nota adicional.',
    });
    expect(html).toContain('Forma de pago');
    expect(html).toContain('contado');
    expect(html).toContain('Nota adicional');
  });

  it('usa tipo_cobro como fallback', () => {
    const html = condicionesComercialesHtmlDesdeMeta({ tipo_cobro: '50_50' });
    expect(html).toContain('50_50');
  });
});

describe('pdfResumenFinancieroDesdeMeta', () => {
  it('sin descuento: monto cero', () => {
    const items = [{ total: 500, detalle: 'A', cantidad: 1, precioUnitario: 500, medidas: '' }];
    const r = pdfResumenFinancieroDesdeMeta(
      { subtotal_materiales: 500, subtotal_extras: 0, subtotal_neto: 500 },
      items as any,
      500,
    );
    expect(r.montoDescuento).toBe(0);
    expect(r.subtotalBruto).toBe(500);
  });
});

describe('buildPresupuestoArgentinoHtml', () => {
  it('incluye columna m² y líneas de descuento cuando hay montoDescuentoPdf', () => {
    const datos = presupuestoApiToDatosPresupuesto(
      {
        id: 'p1',
        codigo: 'P00001',
        lineas: [{ tipo: 'material', material: 'X', unidad: 'm²', metros_cuadrados: 1, precio_unitario: 100 }],
        subtotal_neto: 90,
        iva_monto: 18.9,
        total_final: 108.9,
        meta: {
          subtotal_materiales: 100,
          subtotal_extras: 0,
          subtotal_neto: 90,
          iva_monto: 18.9,
          total_final: 108.9,
          descuento_valor: 10,
          descuento_tipo: 'porcentaje',
        },
      },
      { cliente: { nombre: 'C', direccion: '', telefono: '' }, docId: 'P00001' },
    );
    const html = buildPresupuestoArgentinoHtml(datos);
    expect(html).toContain('th-m2');
    expect(html).toContain('th-medida');
    expect(html).toContain('cell-medida');
    expect(html).toContain('Subtotal c/desc.');
    expect(html).toContain('cell-m2');
    expect(html).not.toContain('P. unitario');
    expect(html).not.toContain('presupuesto-obs-block');
  });

  it('columna m² alineada al subtotal cuando metros_cuadrados viene con menos decimales que el cobro', () => {
    const datos: DatosPresupuesto = {
      id: 'P-T',
      fecha: '23/04/2026',
      cliente: {
        nombre: 'C',
        dni_cuit: '-',
        direccion: '',
        telefono: '',
        condicionIva: 'Consumidor Final',
      },
      empresa: { nombre: 'MUNDO DI MARMI', cuit: '1', direccion: 'SJ' },
      items: [
        {
          detalle: 'gris mara',
          medidas: '1,12×0,2 m',
          cantidad: 0.224,
          precioUnitario: 125_000,
          total: 28_000,
          pdfEsMaterialM2: true,
          pdfCantidadPiezas: 1,
          pdfMetrosCuadrados: 0.22,
          pdfMedida: '1,12×0,2 m',
          recargoLinea: 0,
        },
      ],
      total: 28_000,
      observaciones: '',
      subtotalNeto: 28_000,
      ivaMonto: 5880,
      totalFinal: 33_880,
      ivaTasaDisplayPct: 21,
    };
    const html = buildPresupuestoArgentinoHtml(datos);
    expect(html).toContain('0,224');
  });
});
