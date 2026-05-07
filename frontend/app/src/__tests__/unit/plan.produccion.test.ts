import { describe, it, expect } from "vitest";
import { areaPieza, totalAreaTrabajo, groupTrabajos, prioritizeMedidas, generatePlanLocal } from "../../lib/produccion/plan";

const trabajos = [
  {
    id: "ORD-102",
    cliente: "Constructora Delta",
    material: "Mármol Blanco",
    color: "Blanco Carrara",
    espesor: 20,
    piezas: [
      { ancho: 60, largo: 120, cantidad: 2, descripcion: "Cubierta cocina" },
      { ancho: 30, largo: 60, cantidad: 4, descripcion: "Alzador" },
    ],
  },
  {
    id: "ORD-103",
    cliente: "Hotel Andes",
    material: "Mármol Blanco",
    color: "Blanco Carrara",
    espesor: 20,
    piezas: [
      { ancho: 50, largo: 100, cantidad: 3, descripcion: "Vanitorios" },
      { ancho: 40, largo: 80, cantidad: 2, descripcion: "Revestimiento" },
    ],
  },
];

describe("procesamiento de datos", () => {
  it("calcula área de pieza", () => {
    // areaPieza normaliza cm -> mm para mantener consistencia con packing/corte.
    expect(areaPieza({ ancho: 30, largo: 60, cantidad: 2 })).toBe(360000);
  });
  it("calcula área total de trabajo", () => {
    const t = trabajos[0] as any;
    expect(totalAreaTrabajo(t)).toBeGreaterThan(0);
  });
});

describe("agrupado y priorización", () => {
  it("agrupa por material", () => {
    const grupos = groupTrabajos(trabajos as any, "material");
    expect(grupos.length).toBe(1);
    expect(grupos[0].totalPiezas).toBeGreaterThan(0);
  });
  it("prioriza medidas por área", () => {
    const piezas = trabajos.flatMap((t) => t.piezas);
    const pr = prioritizeMedidas(piezas as any);
    expect(pr[0].area).toBeGreaterThanOrEqual(pr[1].area);
    expect(pr.reduce((s, m) => s + m.count, 0)).toBeGreaterThan(0);
  });
});

describe("plan de corte local", () => {
  it("genera colocaciones y utilización", () => {
    const piezas = trabajos.flatMap((t) => t.piezas) as any;
    const plan = generatePlanLocal(140, 280, piezas, "bestfit");
    expect(plan.utilization).toBeGreaterThan(0);
    expect(plan.placements.length).toBeGreaterThan(0);
  });
});
