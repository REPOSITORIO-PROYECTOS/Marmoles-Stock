import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Login } from './pages/auth/Login';
import { Toaster } from './components/ui/sonner';
import { ProduccionProvider } from './context/ProduccionContext';
import { EntregasProvider } from './context/EntregasContext';

// Lazy loading de componentes pesados para mejorar el tiempo de carga inicial
const ConstructorPresupuestos = lazy(() => import('./pages/ventas/ConstructorPresupuestos').then(m => ({ default: m.ConstructorPresupuestos })));
const PipelineLeads = lazy(() => import('./components/ventas/PipelineLeads').then(m => ({ default: m.PipelineLeads })));
const DashboardComercial = lazy(() => import('./pages/ventas/DashboardComercial').then(m => ({ default: m.DashboardComercial })));
const FinanzasPage = lazy(() => import('./pages/finanzas/FinanzasPage').then(m => ({ default: m.FinanzasPage })));
const DashboardTaller = lazy(() => import('./pages/produccion/DashboardTaller').then(m => ({ default: m.DashboardTaller })));
const ListaPendientes = lazy(() => import('./pages/produccion/ListaPendientes').then(m => ({ default: m.ListaPendientes })));
const DashboardEntregas = lazy(() => import('./pages/logistica/DashboardEntregas').then(m => ({ default: m.DashboardEntregas })));
const DashboardEntregasSimplificado = lazy(() => import('./pages/logistica/DashboardEntregasSimplificado').then(m => ({ default: m.DashboardEntregasSimplificado })));
// const CierreFeedback = lazy(() => import('./pages/logistica/CierreFeedback').then(m => ({ default: m.CierreFeedback })));
const GestionInventario = lazy(() => import('./pages/inventario/GestionInventario').then(m => ({ default: m.GestionInventario })));
const ComprasProveedores = lazy(() => import('./pages/inventario/ComprasProveedoresRefactored').then(m => ({ default: m.ComprasProveedoresRefactored })));
const StockRetazos = lazy(() => import('./pages/inventario/StockRetazos').then(m => ({ default: m.StockRetazos })));
const GestionOrdenes = lazy(() => import('./pages/produccion/GestionOrdenes').then(m => ({ default: m.GestionOrdenes })));
const EtiquetasN12 = lazy(() => import('./pages/produccion/EtiquetasN12').then(m => ({ default: m.EtiquetasN12 })));
const EncuestaPublica = lazy(() => import('./pages/logistica/EncuestaPublica').then(m => ({ default: m.EncuestaPublica })));
const OrdenesEntregaKanban = lazy(() => import('./pages/logistica/OrdenesEntregaKanban').then(m => ({ default: m.OrdenesEntregaKanban })));
const SupervisionObraPage = lazy(() => import('./pages/logistica/SupervisionObra').then(m => ({ default: m.SupervisionObraPage })));

// Componente de carga
const LoadingFallback = () => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

function ProtectedShell({ authed }: { authed: boolean }) {
  if (!authed) return <Navigate to="/login" replace />;
  return (
    <ProduccionProvider>
      <EntregasProvider>
        <div className="flex h-screen bg-background overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto lg:ml-0">
            <div className="animate-fade-in">
              <Outlet />
            </div>
            <Toaster />
          </main>
        </div>
      </EntregasProvider>
    </ProduccionProvider>
  );
}

export default function App() {
  const initialAuthed = useMemo(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("token");
  }, []);

  const [authed, setAuthed] = useState(initialAuthed);
  const [verifying, setVerifying] = useState(!!initialAuthed);

  useEffect(() => {
    const update = () => {
      const hasToken = !!localStorage.getItem("token");
      setAuthed(hasToken);
      if (!hasToken) setVerifying(false);
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);

  useEffect(() => {
    const token = typeof window === "undefined" ? null : localStorage.getItem("token");
    if (!token || token === "null" || token === "undefined") {
      setAuthed(false);
      setVerifying(false);
      return;
    }
    (async () => {
      try {
        setVerifying(true);
        const res = await fetch("/api/usuarios/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("unauthorized");
        setAuthed(true);
      } catch {
        localStorage.removeItem("token");
        setAuthed(false);
      } finally {
        setVerifying(false);
      }
    })();
  }, []);

  if (verifying) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Ruta pública de encuesta - NO requiere autenticación */}
      <Route path="/encuesta/:token" element={<Suspense fallback={<LoadingFallback />}><EncuestaPublica /></Suspense>} />

      <Route
        path="/login"
        element={<Login onLogin={() => setAuthed(true)} />}
      />

      <Route element={<ProtectedShell authed={authed} />}>
        <Route path="/" element={<Navigate to="/produccion/taller" replace />} />

        <Route path="/ventas/presupuestos" element={<Suspense fallback={<LoadingFallback />}><ConstructorPresupuestos /></Suspense>} />
        <Route path="/ventas/constructor" element={<Suspense fallback={<LoadingFallback />}><ConstructorPresupuestos /></Suspense>} />
        <Route path="/ventas/leads" element={<Suspense fallback={<LoadingFallback />}><PipelineLeads /></Suspense>} />
        <Route path="/ventas/dashboard" element={<Suspense fallback={<LoadingFallback />}><DashboardComercial /></Suspense>} />

        <Route path="/finanzas" element={<Suspense fallback={<LoadingFallback />}><FinanzasPage /></Suspense>} />

        <Route path="/produccion/taller" element={<Suspense fallback={<LoadingFallback />}><DashboardTaller /></Suspense>} />
        <Route path="/produccion/pendientes" element={<Suspense fallback={<LoadingFallback />}><ListaPendientes /></Suspense>} />
        <Route path="/produccion/etiquetas-n12" element={<Suspense fallback={<LoadingFallback />}><EtiquetasN12 /></Suspense>} />
        {/* <Route path="/produccion/aprobaciones" element={<MaestroAprobaciones />} /> */}
        {/* <Route path="/produccion/acumulados" element={<TableroAcumulados />} /> */}
        <Route path="/produccion/planos" element={<Suspense fallback={<LoadingFallback />}><GestionOrdenes /></Suspense>} />
        <Route path="/produccion/ordenes" element={<Suspense fallback={<LoadingFallback />}><GestionOrdenes /></Suspense>} />

        <Route path="/logistica/entregas" element={<Suspense fallback={<LoadingFallback />}><DashboardEntregas /></Suspense>} />
        <Route path="/logistica/entregas-simple" element={<Suspense fallback={<LoadingFallback />}><DashboardEntregasSimplificado /></Suspense>} />
        <Route path="/logistica/ordenes" element={<Suspense fallback={<LoadingFallback />}><OrdenesEntregaKanban /></Suspense>} />
        <Route path="/logistica/supervision" element={<Suspense fallback={<LoadingFallback />}><SupervisionObraPage /></Suspense>} />
        {/* <Route path="/logistica/feedback" element={<Suspense fallback={<LoadingFallback />}><CierreFeedback /></Suspense>} /> */}

        <Route path="/inventario/gestion" element={<Suspense fallback={<LoadingFallback />}><GestionInventario /></Suspense>} />
        <Route path="/inventario/compras" element={<Suspense fallback={<LoadingFallback />}><ComprasProveedores /></Suspense>} />
        <Route path="/inventario/retazos" element={<Suspense fallback={<LoadingFallback />}><StockRetazos /></Suspense>} />

        <Route path="*" element={<Navigate to="/produccion/taller" replace />} />
      </Route>
    </Routes>
  );
}
