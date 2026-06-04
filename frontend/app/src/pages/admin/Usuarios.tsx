import { useEffect, useState } from 'react';
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

interface Usuario {
  id: string;
  username: string;
  email: string;
  role: string;
  active: boolean;
  locked: boolean;
}

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'deposito', label: 'Depósito' },
];

function roleBadge(role: string) {
  if (role === 'admin') return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Admin</Badge>;
  if (role === 'ventas') return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Ventas</Badge>;
  return <Badge className="bg-gray-100 text-gray-700 border-gray-200">{role}</Badge>;
}

export function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal crear
  const [modalCrear, setModalCrear] = useState(false);
  const [nuevoUsername, setNuevoUsername] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [nuevoRol, setNuevoRol] = useState('ventas');
  const [guardando, setGuardando] = useState(false);

  // Modal editar
  const [modalEditar, setModalEditar] = useState<Usuario | null>(null);
  const [editRol, setEditRol] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Modal reset password
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

  useEffect(() => { void cargarUsuarios(); }, []);

  const handleCrear = async () => {
    if (!nuevoUsername.trim() || !nuevoEmail.trim() || !nuevoPassword) {
      toast.error('Completá todos los campos');
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
      setNuevoUsername(''); setNuevoEmail(''); setNuevoPassword(''); setNuevoRol('ventas');
      void cargarUsuarios();
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al crear usuario');
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
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al editar');
    } finally {
      setGuardando(false);
    }
  };

  const handleReset = async () => {
    if (!modalReset) return;
    if (resetPassword.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    try {
      setGuardando(true);
      await post(`/api/usuarios/${modalReset.id}/reset-password`, { nueva_password: resetPassword });
      toast.success(`Contraseña de "${modalReset.username}" reseteada`);
      setModalReset(null);
      setResetPassword('');
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al resetear');
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
    } catch (e: any) {
      toast.error(e?.message ?? 'Error');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
            <p className="text-sm text-muted-foreground">{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado{usuarios.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button onClick={() => setModalCrear(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      {/* Tabla */}
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
                        onClick={() => { setModalEditar(u); setEditRol(u.role); setEditEmail(u.email); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Resetear contraseña"
                        onClick={() => { setModalReset(u); setResetPassword(''); }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={u.active ? 'Desactivar' : 'Reactivar'}
                        onClick={() => handleToggleActivo(u)}
                        className={u.active ? 'text-destructive hover:text-destructive' : 'text-green-600 hover:text-green-700'}
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

      {/* Modal crear usuario */}
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
              <Input value={nuevoUsername} onChange={e => setNuevoUsername(e.target.value)} placeholder="ej: maria.garcia" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} placeholder="email@ejemplo.com" />
            </div>
            <div className="space-y-1">
              <Label>Contraseña inicial</Label>
              <Input type="password" value={nuevoPassword} onChange={e => setNuevoPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-1">
              <Label>Rol</Label>
              <Select value={nuevoRol} onValueChange={setNuevoRol}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCrear(false)}>Cancelar</Button>
            <Button onClick={handleCrear} disabled={guardando}>
              {guardando ? 'Creando...' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal editar */}
      <Dialog open={!!modalEditar} onOpenChange={v => !v && setModalEditar(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" /> Editar — {modalEditar?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Rol</Label>
              <Select value={editRol} onValueChange={setEditRol}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEditar(null)}>Cancelar</Button>
            <Button onClick={handleEditar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal reset password */}
      <Dialog open={!!modalReset} onOpenChange={v => !v && setModalReset(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Resetear contraseña — {modalReset?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Ingresá la nueva contraseña para este usuario.</p>
            <div className="space-y-1">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalReset(null)}>Cancelar</Button>
            <Button onClick={handleReset} disabled={guardando}>
              {guardando ? 'Reseteando...' : 'Resetear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
