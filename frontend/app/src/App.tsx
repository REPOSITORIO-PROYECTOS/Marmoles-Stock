import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Login } from './pages/auth/Login';
import { Toaster } from './components/ui/sonner';

const DashboardStock = lazy(() => import('./pages/inventario/DashboardStock').then(m => ({ default: m.DashboardStock })));
const GestionInventario = lazy(() => import('./pages/inventario/GestionInventario').then(m => ({ default: m.GestionInventario })));
const ComprasProveedores = lazy(() => import('./pages/inventario/ComprasProveedoresRefactored').then(m => ({ default: m.ComprasProveedoresRefactored })));
const StockRetazos = lazy(() => import('./pages/inventario/StockRetazos').then(m => ({ default: m.StockRetazos })));

// Componente de carga
const LoadingFallback = () => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

function ProtectedShell({ authed }: { authed: boolean }) {
  if (!authed) return <Navigate to="/login" replace />;
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto lg:ml-0">
        <div className="animate-fade-in">
          <Outlet />
        </div>
        <Toaster />
      </main>
    </div>
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
      <Route
        path="/login"
        element={<Login onLogin={() => setAuthed(true)} />}
      />

      <Route element={<ProtectedShell authed={authed} />}>
        <Route path="/" element={<Navigate to="/inventario/dashboard" replace />} />

        <Route path="/ventas/presupuestos" element={<Navigate to="/inventario/dashboard" replace />} />
        <Route path="/ventas/constructor" element={<Navigate to="/inventario/dashboard" replace />} />
        <Route path="/ventas/leads" element={<Navigate to="/inventario/dashboard" replace />} />
        <Route path="/finanzas" element={<Navigate to="/inventario/dashboard" replace />} />

        <Route path="/inventario/dashboard" element={<Suspense fallback={<LoadingFallback />}><DashboardStock /></Suspense>} />
        <Route path="/inventario/gestion" element={<Suspense fallback={<LoadingFallback />}><GestionInventario /></Suspense>} />
        <Route path="/inventario/compras" element={<Suspense fallback={<LoadingFallback />}><ComprasProveedores /></Suspense>} />
        <Route path="/inventario/retazos" element={<Suspense fallback={<LoadingFallback />}><StockRetazos /></Suspense>} />

        <Route path="*" element={<Navigate to="/inventario/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
