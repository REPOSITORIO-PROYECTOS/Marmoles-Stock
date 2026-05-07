import { describe, it, expect } from 'vitest';
import {
  lineasApiDesdeAmbientes,
  ambienteVacio,
  piezaVacia,
  nuevoId,
  metrosCuadradosPieza,
} from './presupuestoConstructor';

describe('lineasApiDesdeAmbientes', () => {
  it('genera líneas material y extra', () => {
    const amb = ambienteVacio('Cocina');
    const p = piezaVacia();
    p.material_id = 'm1';
    p.material_nombre = 'Granito';
    p.m2 = 2;
    p.precio_m2 = 100;
    p.extras = [
      {
        id: nuevoId(),
        servicio_id: 's1',
        nombre: 'Bacha',
        precio: 50,
        cantidad: 1,
      },
    ];
    amb.piezas = [p];
    const lineas = lineasApiDesdeAmbientes([amb]);
    expect(lineas).toHaveLength(2);
    expect(lineas[0].tipo).toBe('material');
    expect(lineas[0].material_id).toBe('m1');
    expect(lineas[1].tipo).toBe('extra');
    expect(lineas[1].servicio_id).toBe('s1');
  });

  it('usa largo × ancho para m² en API cuando ambos > 0', () => {
    const amb = ambienteVacio('Baño');
    const p = piezaVacia();
    p.material_id = 'm1';
    p.material_nombre = 'Mármol';
    p.precio_m2 = 200;
    p.largo_m = 2;
    p.ancho_m = 1.5;
    p.m2 = 0;
    amb.piezas = [p];
    expect(metrosCuadradosPieza(p)).toBe(3);
    const lineas = lineasApiDesdeAmbientes([amb]);
    expect(lineas[0].metros_cuadrados).toBe(3);
    expect(String(lineas[0].medidas)).toMatch(/2×1,5 m/);
  });

  it('no deja “Nota / medidas” viejas pisar L×W: manda medidas canónicas y m² coherente con largo×ancho', () => {
    const amb = ambienteVacio('Cocina');
    const p = piezaVacia();
    p.material_id = 'm1';
    p.material_nombre = 'Negro Boreal';
    p.precio_m2 = 135000;
    p.largo_m = 1.2;
    p.ancho_m = 2.432;
    p.m2 = 0;
    p.medidas = '1,20 x 2,00 m';
    amb.piezas = [p];
    const m2u = metrosCuadradosPieza(p);
    expect(m2u).toBeCloseTo(2.9184, 4);
    const lineas = lineasApiDesdeAmbientes([amb]);
    expect(String(lineas[0].medidas)).toMatch(/1,2×2,432 m/);
    expect(lineas[0].metros_cuadrados).toBeCloseTo(2.9184, 4);
  });

  it('multiplica m² en API según cantidad de piezas iguales', () => {
    const amb = ambienteVacio('Cocina');
    const p = piezaVacia();
    p.material_id = 'm1';
    p.material_nombre = 'Granito';
    p.m2 = 2;
    p.precio_m2 = 100;
    p.cantidad_piezas = 4;
    amb.piezas = [p];
    const lineas = lineasApiDesdeAmbientes([amb]);
    expect(lineas[0].metros_cuadrados).toBe(8);
    expect(String(lineas[0].medidas)).toContain('4 piezas');
  });
});
