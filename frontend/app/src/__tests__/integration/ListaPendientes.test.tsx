import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListaPendientes } from "../../pages/produccion/ListaPendientes";
import { MemoryRouter } from "react-router-dom";
import { ProduccionProvider } from "../../context/ProduccionContext";

function mockFetchSequence() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    if (url.includes("/api/n12/op")) {
      return { ok: true, json: async () => [] } as any;
    }
    if (url.includes("/api/n12/visitas")) {
      return { ok: true, json: async () => [] } as any;
    }
    if (url.includes("/api/trabajos")) {
      return {
        ok: true,
        json: async () => ([
          {
            id: "ORD-200",
            cliente: "Cliente A",
            material: "Granito Negro",
            color: "Negro Absoluto",
            espesor: 20,
            estado: "pendiente",
            prioridad: "alta",
            visita_tecnica: true,
            aprobado_jefe: true,
            sena_abonada: true,
            medidas_corregidas: true,
            piezas: [
              { ancho: 60, largo: 120, cantidad: 1, descripcion: "Cubierta" },
            ],
          },
          {
            id: "ORD-201",
            cliente: "Cliente B",
            material: "Granito Negro",
            color: "Negro Absoluto",
            espesor: 20,
            estado: "pendiente",
            prioridad: "media",
            visita_tecnica: true,
            aprobado_jefe: true,
            sena_abonada: true,
            medidas_corregidas: true,
            piezas: [
              { ancho: 50, largo: 100, cantidad: 2, descripcion: "Vanitorio" },
            ],
          },
        ]),
      } as any;
    }
    if (url.includes("/api/produccion/plancha/planificar")) {
      return {
        ok: true,
        json: async () => ({ utilization: 0.75 }),
      } as any;
    }
    return { ok: false, status: 404 } as any;
  });
  vi.stubGlobal("fetch", fetchMock as any);
  return fetchMock;
}

describe("ListaPendientes integración", () => {
  beforeEach(() => {
    mockFetchSequence();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("carga trabajos y muestra contadores", async () => {
    render(
      <MemoryRouter>
        <ProduccionProvider>
          <ListaPendientes />
        </ProduccionProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Trabajos")).toBeDefined());
    expect(screen.getByText(/Área total/)).toBeDefined();
  });

  it("crea lote y muestra plan y medidas priorizadas", async () => {
    render(
      <MemoryRouter>
        <ProduccionProvider>
          <ListaPendientes />
        </ProduccionProvider>
      </MemoryRouter>
    );
    const crearLote = await screen.findByRole("button", { name: /Crear lote/i });
    await userEvent.click(crearLote);
    await screen.findByText(/Mapa de plancha/);
    await screen.findByText(/Plan de corte/);
    await screen.findByText(/Medidas priorizadas/);
  });

  it("muestra utilización local en el diálogo de plan de corte", async () => {
    render(
      <MemoryRouter>
        <ProduccionProvider>
          <ListaPendientes />
        </ProduccionProvider>
      </MemoryRouter>
    );
    const crearLote = await screen.findByRole("button", { name: /Crear lote/i });
    await userEvent.click(crearLote);
    await screen.findByText(/Mapa de plancha/i);
    await screen.findByText(/Utilización local:\s*[\d.]+%/i);
  });

  it("debe mostrar indicadores de la Regla de Oro (Visita, Seña, Aprobación)", async () => {
    render(
      <MemoryRouter>
        <ProduccionProvider>
          <ListaPendientes />
        </ProduccionProvider>
      </MemoryRouter>
    );
    await waitFor(() => {
      // Cliente A tiene todo OK en el mock
      expect(screen.getAllByTitle(/OK/)).toBeDefined();
    });
  });
});
