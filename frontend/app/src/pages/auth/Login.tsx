import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "../../api";
import { toast } from "sonner";
import { LogIn, User } from "lucide-react";

type Props = {
  onLogin: () => void;
};

export function Login({ onLogin }: Props) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!usuario.trim() || !password) {
      toast.error("Ingresá usuario y contraseña");
      return;
    }
    try {
      setLoading(true);
      const resp = await post<{ token: string }>("/api/auth/login", {
        usuario: usuario.trim(),
        password,
      });
      if (resp && (resp as any).token) {
        localStorage.setItem("token", (resp as any).token);
        onLogin();
        navigate("/produccion/taller", { replace: true });
        return;
      }
      toast.error("Credenciales inválidas");
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "";
      if (message.includes("401")) toast.error("Credenciales inválidas");
      else toast.error("No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
            <svg viewBox="0 0 64 64" className="h-6 w-6 text-primary" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M20 22c-4-3-8-3-10 2-2 5 0 15 4 17 3 2 6-2 7-6l-1-13Z" fill="currentColor" opacity=".35"/>
              <path d="M44 22c4-3 8-3 10 2 2 5 0 15-4 17-3 2-6-2-7-6l1-13Z" fill="currentColor" opacity=".35"/>
              <path d="M14 33c0-10 8-18 18-18s18 8 18 18v6c0 9-7 16-16 16h-4c-9 0-16-7-16-16v-6Z" fill="currentColor" opacity=".20"/>
              <path d="M20 33c0-6 5-11 12-11s12 5 12 11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".55"/>
              <path d="M28 40c0 2-1 3-3 3s-3-1-3-3 1-3 3-3 3 1 3 3Z" fill="currentColor" opacity=".55"/>
              <path d="M42 40c0 2-1 3-3 3s-3-1-3-3 1-3 3-3 3 1 3 3Z" fill="currentColor" opacity=".55"/>
              <path d="M32 44c2 0 4 1 4 3 0 3-2 6-4 6s-4-3-4-6c0-2 2-3 4-3Z" fill="currentColor" opacity=".6"/>
              <path d="M22 49c3 3 7 5 10 5s7-2 10-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".55"/>
            </svg>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold leading-tight">JAVIER FLORES MÁRMOLES Y GRANITOS</div>
            <div className="text-sm text-muted-foreground">Sistema de Gestión</div>
          </div>
        </div>

        <Card className="w-full shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-4 w-4" />
              Iniciar sesión
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-2">
                <Label htmlFor="usuario">Usuario</Label>
                <div className="relative">
                  <User className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    id="usuario"
                    placeholder="admin"
                    className="pl-9"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contrasena">Contraseña</Label>
                <Input
                  id="contrasena"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>

              <Button className="w-full" type="submit" disabled={loading}>
                Entrar
              </Button>
            </form>

            <div className="text-xs text-muted-foreground border-t pt-4">
              <div>Acceso restringido.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
