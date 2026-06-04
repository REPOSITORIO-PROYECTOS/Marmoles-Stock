import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../../api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { UserPlus, KeyRound, Pencil, UserX, UserCheck, ShieldCheck } from 'lucide-react';
import { BRAND_LEGAL_NAME, BRAND_TAGLINE } from '../../brand';
import { ROLE_DEPOSITO, rolesForApp, roleLabel, type AppRole } from '../../config/roles';

interface Usuario {
  id: string;
  username: string;
  email: string;
  role: string;
  active: boolean;
  locked: boolean;
}

function roleBadge(role: string) {
  if (role === 'admin') {
    return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Administrador</Badge>;
  }
  if (role === 'deposito') {
    return <Badge className="bg-amber-100 text-amber-900 border-amber-200">Depósito</Badge>;
  }
  if (role === 'ventas') {
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Ventas</Badge>;
  }
  return <Badge className="bg-gray-100 text-gray-700 border-gray-200">{roleLabel(role)}</Badge>;
}

export function Usuarios() {
  const navigate = useNavigate();
  const appRoles = rolesForApp();
  const defaultRole = ROLE_DEPOSITO;

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  const [modalCrear, setModalCrear] = useState(false);
  const [nuevoUsername, setNuevoUsername] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [nuevoRol, setNuevoRol] = useState<AppRole>(defaultRole);
  const [guardando, setGuardando] = useState(false);

  const [modalEditar, setModalEditar] = useState<Usuario | null>(null);
  const [editRol, setEditRol] = useState<AppRole>(defaultRole);
  const [editEmail, setEditEmail] = useState('');

  const [modalReset, setModalReset] = useState<Usuario | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const cargarUsuarios = async () => {
    try {
      const data = await get<Usuario[]>('/api/usuarios');
      setUsuarios(data);
    } catch {
      toast.error('No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await get<{ role: string }>('/api/usuarios/me');
        if (me?.role !== 'admin') {
          toast.error('Solo administradores pueden gestionar usuarios');
          navigate('/inventario/dashboard', { replace: true });
          return;
        }
        setCanManage(true);
        await cargarUsuarios();
      } catch {
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate]);

  const handleCrear = async () => {
    if (!nuevoUsername.trim() || !nuevoEmail.trim() || !nuevoPassword) {
      toast.error('Completá todos los campos');
      return;
    }
    if (nuevoPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    try {
      setGuardando(true);
      await post('/api/usuarios', {
        username: nuevoUsername.trim(),
        email: nuevoEmail.trim(),
        password: nuevoPassword,
        rol: nuevoRol,
      });
      toast.success(`Usuario "${nuevoUsername}" creado`);
      setModalCrear(false);
      setNuevoUsername('');
      setNuevoEmail('');
      setNuevoPassword('');
      setNuevoRol(defaultRole);
      void cargarUsuarios();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al crear usuario';
      toast.error(msg);
    } finally {
      setGuardando(false);
    }
  };

  const handleEditar = async () => {
    if (!modalEditar) return;
    try {
      setGuardando(true);
      await put(`/api/usuarios/${modalEditar.id}`, { role: editRol, email: editEmail });
      toast.success('Usuario actualizado');
      setModalEditar(null);
      void cargarUsuarios();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al editar';
      toast.error(msg);
    } finally {
      setGuardando(false);
    }
  };

  const handleReset = async () => {
    if (!modalReset) return;
    if (resetPassword.length < 6) {
      toast.error('Mínimo 6 caracteres');
      return;
    }
    try {
      setGuardando(true);
      await post(`/api/usuarios/${modalReset.id}/reset-password`, { nueva_password: resetPassword });
      toast.success(`Contraseña de "${modalReset.username}" actualizada`);
      setModalReset(null);
      setResetPassword('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al resetear';
      toast.error(msg);
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleActivo = async (u: Usuario) => {
    try {
      if (u.active) {
        await del(`/api/usuarios/${u.id}`);
        toast.success(`"${u.username}" desactivado`);
      } else {
        await put(`/api/usuarios/${u.id}`, { active: true });
        toast.success(`"${u.username}" reactivado`);
      }
      void cargarUsuarios();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      toast.error(msg);
    }
  };

  if (!canManage) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Gestión de usuarios</h1>
            <p className="text-sm text-muted-foreground">
              {BRAND_LEGAL_NAME} · {BRAND_TAGLINE}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado
              {usuarios.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button onClick={() => setModalCrear(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usuario</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => (
                <tr key={u.id} className={`border-b last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">{roleBadge(u.role)}</td>
                  <td className="px-4 py-3">
                    {u.locked ? (
                      <Badge variant="destructive">Bloqueado</Badge>
                    ) : u.active ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Editar"
                        onClick={() => {
                          setModalEditar(u);
                          setEditRol((u.role as AppRole) || defaultRole);
                          setEditEmail(u.email);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Resetear contraseña"
                        onClick={() => {
                          setModalReset(u);
                          setResetPassword('');
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={u.active ? 'Desactivar' : 'Reactivar'}
                        onClick={() => handleToggleActivo(u)}
                        className={
                          u.active
                            ? 'text-destructive hover:text-destructive'
                            : 'text-green-600 hover:text-green-700'
                        }
                      >
                        {u.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalCrear} onOpenChange={setModalCrear}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Nuevo usuario
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Usuario</Label>
              <Input
                value={nuevoUsername}
                onChange={(e) => setNuevoUsername(e.target.value)}
                placeholder="ej: operador.deposito"
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={nuevoEmail}
                onChange={(e) => setNuevoEmail(e.target.value)}
                placeholder="usuario@mundo-di-marmi.local"
              />
            </div>
            <div className="space-y-1">
              <Label>Contraseña inicial</Label>
              <Input
                type="password"
                value={nuevoPassword}
                onChange={(e) => setNuevoPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-1">
              <Label>Rol</Label>
              <Select value={nuevoRol} onValueChange={(v) => setNuevoRol(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {appRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCrear(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCrear} disabled={guardando}>
              {guardando ? 'Creando...' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!modalEditar} onOpenChange={(v) => !v && setModalEditar(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" /> Editar — {modalEditar?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Rol</Label>
              <Select value={editRol} onValueChange={(v) => setEditRol(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {appRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEditar(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!modalReset} onOpenChange={(v) => !v && setModalReset(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Resetear contraseña — {modalReset?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Ingresá la nueva contraseña para este usuario.
            </p>
            <div className="space-y-1">
              <Label>Nueva contraseña</Label>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalReset(null)}>
              Cancelar
            </Button>
            <Button onClick={handleReset} disabled={guardando}>
              {guardando ? 'Reseteando...' : 'Guardar contraseña'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
