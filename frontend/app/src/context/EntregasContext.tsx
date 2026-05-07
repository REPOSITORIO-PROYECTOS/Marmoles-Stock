import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface LogEntrega {
  id: string;
  timestamp: string;
  accion: string;
  usuario: string;
  detalles?: string;
}

export interface EntregaCompletada {
  id: string;
  ordenId: string;
  presupuesto: string;
  cliente: string;
  tipoCliente: 'constructor' | 'cliente_final';
  fechaEntrega: string;
  direccion?: string;
  firmaCliente?: string;
  nombreFirmante?: string;
  logs: LogEntrega[];
}

interface EntregasContextValue {
  entregas: EntregaCompletada[];
  addEntrega: (entrega: EntregaCompletada) => void;
}

const LS_KEY = 'entregas_completadas';

const EntregasContext = createContext<EntregasContextValue | undefined>(undefined);

export function EntregasProvider({ children }: { children: ReactNode }) {
  const genId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
  const [entregas, setEntregas] = useState<EntregaCompletada[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr: EntregaCompletada[] = raw ? JSON.parse(raw) : [];
      const seen = new Set<string>();
      return arr.map((e) => {
        const id = e.id && !seen.has(e.id) ? e.id : genId();
        seen.add(id);
        const logSeen = new Set<string>();
        const logs = (e.logs || []).map((l) => {
          const lid = l.id && !logSeen.has(l.id) ? l.id : genId();
          logSeen.add(lid);
          return { ...l, id: lid };
        });
        return { ...e, id, logs };
      });
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(entregas));
    } catch {}
  }, [entregas]);

  const addEntrega = (entrega: EntregaCompletada) => {
    setEntregas((prev) => {
      const exists = prev.some((e) => e.id === entrega.id);
      const fixedLogs = (entrega.logs || []).map((l) => ({ ...l, id: l.id || genId() }));
      const next = { ...entrega, id: exists ? genId() : (entrega.id || genId()), logs: fixedLogs };
      return [next, ...prev];
    });
  };

  return (
    <EntregasContext.Provider value={{ entregas, addEntrega }}>
      {children}
    </EntregasContext.Provider>
  );
}

export function useEntregas() {
  const ctx = useContext(EntregasContext);
  if (!ctx) throw new Error('useEntregas debe usarse dentro de EntregasProvider');
  return ctx;
}
