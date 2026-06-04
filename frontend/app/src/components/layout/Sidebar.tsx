import React, { type ReactNode } from 'react';
import {
  Users,
  BarChart3,
  FileText,
  Phone,
  DollarSign,
  Hammer,
  Eye,
  Truck,
  MessageSquare,
  Package,
  ShoppingCart,
  Scissors,
  Layers,
  ClipboardList,
  Menu,
  X,
  Palette,
  Ruler,
  Briefcase,
  ClipboardCheck,
  Tag,
  ShieldCheck,
  FileSpreadsheet,
  LogOut,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BRAND_COPYRIGHT,
  BRAND_LEGAL_NAME,
  BRAND_MONOGRAM,
  BRAND_TAGLINE,
  INVENTORY_MENU_CATEGORY,
} from '../../brand';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { get, post, logoutSession } from '../../api';
import { toast } from 'sonner';

interface SidebarProps { }

interface MenuItem {
  path: string;
  label: string;
  icon: ReactNode;
  category: string;
  adminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  { path: '/ventas/presupuestos', label: 'Crear Presupuesto', icon: <FileText className="h-5 w-5" />, category: 'CRM/Ventas' },
  { path: '/ventas/leads', label: 'Pipeline de Leads', icon: <Users className="h-5 w-5" />, category: 'CRM/Ventas' },
  { path: '/ventas/dashboard', label: 'Dashboard Comercial', icon: <BarChart3 className="h-5 w-5" />, category: 'CRM/Ventas' },
  { path: '/finanzas', label: 'Finanzas y Cobranzas', icon: <DollarSign className="h-5 w-5" />, category: 'Financiero' },

  { path: '/produccion/ordenes', label: 'Órdenes de Visita', icon: <ClipboardCheck className="h-5 w-5" />, category: 'Producción' },
  { path: '/produccion/taller', label: 'Dashboard Taller', icon: <Hammer className="h-5 w-5" />, category: 'Producción' },
  { path: '/produccion/pendientes', label: 'Lista de Pendientes', icon: <ClipboardList className="h-5 w-5" />, category: 'Producción' },
  { path: '/produccion/etiquetas-n12', label: 'Etiquetas N12', icon: <Tag className="h-5 w-5" />, category: 'Producción' },


  { path: '/logistica/entregas', label: 'Dashboard Entregas', icon: <Truck className="h-5 w-5" />, category: 'Logística' },
  { path: '/logistica/ordenes', label: 'Tablero órdenes entrega', icon: <Package className="h-5 w-5" />, category: 'Logística' },
  { path: '/logistica/supervision', label: 'Supervisión de obra', icon: <Eye className="h-5 w-5" />, category: 'Logística' },


  { path: '/inventario/dashboard', label: 'Dashboard', icon: <BarChart3 className="h-5 w-5" />, category: INVENTORY_MENU_CATEGORY },
  { path: '/inventario/gestion', label: 'Gestión Inventario', icon: <Package className="h-5 w-5" />, category: INVENTORY_MENU_CATEGORY },
  { path: '/inventario/excel', label: 'Importar / Exportar Excel', icon: <FileSpreadsheet className="h-5 w-5" />, category: INVENTORY_MENU_CATEGORY, adminOnly: true },
  { path: '/inventario/compras', label: 'Compras y Proveedores', icon: <ShoppingCart className="h-5 w-5" />, category: INVENTORY_MENU_CATEGORY },
  { path: '/inventario/retazos', label: 'Stock de Retazos', icon: <Layers className="h-5 w-5" />, category: INVENTORY_MENU_CATEGORY },
];

const DEPOSITO_ONLY = import.meta.env.VITE_DEPOSITO_ONLY === 'true';

export function Sidebar({ }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [username, setUsername] = useState('Usuario');
  const [userRole, setUserRole] = useState('');
  const location = useLocation();
  const currentPath = location.pathname;
  const visibleMenuItems = menuItems.filter((item) => {
    if (item.adminOnly && userRole !== 'admin') return false;
    if (DEPOSITO_ONLY || userRole === 'deposito') {
      return item.category === INVENTORY_MENU_CATEGORY;
    }
    return true;
  });
  const categories = Array.from(new Set(visibleMenuItems.map((item) => item.category)));

  const handleLinkClick = () => {
    setIsOpen(false); // Cerrar sidebar en móvil después de seleccionar
  };

  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null;
    const handler = () => setIsDesktop(!!mq?.matches);
    handler();
    mq?.addEventListener('change', handler);
    return () => mq?.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const me = await get<{ username: string; role: string }>('/api/usuarios/me');
        if (me?.username) setUsername(me.username);
        if (me?.role) setUserRole(me.role);
      } catch {
        // Silencioso: si la sesión expiró, api.ts ya redirige a login.
      }
    };
    void loadUser();
  }, []);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Completá contraseña actual y nueva');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    try {
      setIsSavingPassword(true);
      await post<{ ok: boolean }>('/api/auth/change-password', {
        password_actual: currentPassword,
        password_nueva: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setIsUserMenuOpen(false);
      toast.success('Contraseña actualizada');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cambiar la contraseña';
      toast.error(message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logoutSession();
  };

  return (
    <>
      {/* Botón hamburguesa para móvil */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-primary text-primary-foreground p-2 rounded-lg shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Overlay para móvil */}
      {isOpen && !isDesktop && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isDesktop ? 'static' : 'fixed'} inset-y-0 left-0 z-40
          w-72 bg-gradient-to-b from-sidebar to-sidebar-accent
          ${isDesktop ? 'shadow-none' : 'shadow-xl'}
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isDesktop ? 'translate-x-0' : isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-primary font-bold text-lg tracking-tight">{BRAND_MONOGRAM}</span>
            </div>
            <div>
              <h1 className="text-sidebar-foreground text-xs font-bold leading-tight tracking-wide">
                {BRAND_LEGAL_NAME}
              </h1>
              <p className="text-sidebar-foreground/70 text-sm mt-0.5">{BRAND_TAGLINE}</p>
            </div>
          </div>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6 scrollbar-thin">
          {categories.map((category, idx) => (
            // eslint-disable-next-line react/forbid-dom-props
            <div
              key={category}
              className="animate-slide-in"
              style={{ "--animation-delay": `${idx * 0.05}s` } as React.CSSProperties}
            >

              <h3 className="text-sidebar-foreground/60 text-sm mb-3 px-3 uppercase tracking-wider">
                {category}
              </h3>
              <div className="space-y-1">
                {visibleMenuItems
                  .filter(item => item.category === category)
                  .map(item => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={handleLinkClick}
                    >
                      <Button
                        variant={currentPath === item.path ? 'default' : 'ghost'}
                        className={`
                        w-full justify-start gap-3 h-11
                        transition-all duration-200
                        ${currentPath === item.path
                            ? 'bg-white text-primary shadow-md hover:bg-white/95'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white'
                          }
                      `}
                      >
                        <span className={currentPath === item.path ? 'text-primary' : ''}>
                          {item.icon}
                        </span>
                        <span className="flex-1 text-left">{item.label}</span>
                      </Button>
                    </Link>
                  ))}
              </div>
            </div>
          ))}

          {/* Sección Administración — solo visible para admin */}
          {userRole === 'admin' && (
            <div className="animate-slide-in">
              <h3 className="text-sidebar-foreground/60 text-sm mb-3 px-3 uppercase tracking-wider">
                Administración
              </h3>
              <div className="space-y-1">
                <Link to="/admin/usuarios" onClick={handleLinkClick}>
                  <Button
                    variant={currentPath === '/admin/usuarios' ? 'default' : 'ghost'}
                    className={`
                      w-full justify-start gap-3 h-11 transition-all duration-200
                      ${currentPath === '/admin/usuarios'
                        ? 'bg-white text-primary shadow-md hover:bg-white/95'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white'
                      }
                    `}
                  >
                    <span className={currentPath === '/admin/usuarios' ? 'text-primary' : ''}>
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <span className="flex-1 text-left">Gestión de usuarios</span>
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className="w-full mb-3 rounded-lg border border-sidebar-border bg-sidebar/40 px-3 py-2 text-left text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
          >
            <p className="text-xs text-sidebar-foreground/60">Usuario</p>
            <p className="text-sm font-medium">{username}</p>
          </button>
          {isUserMenuOpen && (
            <div className="mb-3 rounded-lg border border-sidebar-border bg-sidebar/30 p-3 space-y-3">
              <p className="text-xs uppercase tracking-wide text-sidebar-foreground/60">Cambiar contraseña</p>
              <div className="space-y-1">
                <Label htmlFor="password-actual" className="text-sidebar-foreground/80 text-xs">Contraseña actual</Label>
                <Input
                  id="password-actual"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-9 bg-white/95"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password-nueva" className="text-sidebar-foreground/80 text-xs">Nueva contraseña</Label>
                <Input
                  id="password-nueva"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-9 bg-white/95"
                />
              </div>
              <Button
                type="button"
                onClick={handleChangePassword}
                disabled={isSavingPassword}
                className="w-full"
              >
                {isSavingPassword ? 'Guardando...' : 'Guardar contraseña'}
              </Button>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            className="w-full mb-3 gap-2 border-sidebar-border/80 bg-white/10 text-sidebar-foreground hover:bg-white/20 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
          <div className="bg-sidebar-accent rounded-lg p-4">
            <p className="text-sidebar-foreground/80 text-sm">
              {BRAND_MONOGRAM} · {BRAND_TAGLINE}
            </p>
            <p className="text-sidebar-foreground/60 text-xs mt-1">
              {BRAND_COPYRIGHT}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
