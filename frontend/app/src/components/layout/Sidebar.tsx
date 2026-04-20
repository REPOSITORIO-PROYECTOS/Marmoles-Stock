import React, { type ReactNode } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Layers,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps { }

interface MenuItem {
  path: string;
  label: string;
  icon: ReactNode;
  category: string;
}

const menuItems: MenuItem[] = [
  { path: '/inventario/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, category: 'Inventario' },
  { path: '/inventario/gestion', label: 'Gestión Inventario', icon: <Package className="h-5 w-5" />, category: 'Inventario' },
  { path: '/inventario/compras', label: 'Compras y Proveedores', icon: <ShoppingCart className="h-5 w-5" />, category: 'Inventario' },
  { path: '/inventario/retazos', label: 'Stock de Retazos', icon: <Layers className="h-5 w-5" />, category: 'Inventario' },
];

export function Sidebar({ }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const categories = Array.from(new Set(menuItems.map(item => item.category)));

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
              <span className="text-primary font-bold text-xl">MDM</span>
            </div>
            <div>
              <h1 className="text-sidebar-foreground text-xs font-bold leading-tight">
                MUNDO DI MARMI
              </h1>
              <p className="text-sidebar-foreground/70 text-sm">Inventario y depósito</p>
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
                {menuItems
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
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="bg-sidebar-accent rounded-lg p-4">
            <p className="text-sidebar-foreground/80 text-sm">
              Mundo di Marmi · Sistema de Gestión v2.0
            </p>
            <p className="text-sidebar-foreground/60 text-xs mt-1">
              © 2026 Mundo di Marmi
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
