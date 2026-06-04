import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "../../api";
import { toast } from "sonner";
import { LogIn, MonitorDown, User } from "lucide-react";
import { BRAND_LEGAL_NAME, BRAND_MONOGRAM, BRAND_TAGLINE, DESKTOP_RELEASES_URL } from "../../brand";
import { isElectronApp } from "../../utils/isElectronApp";

type Props = {
  onLogin: () => void;
};

export function Login({ onLogin }: Props) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const showDesktopDownload = !isElectronApp();

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
        navigate("/inventario/dashboard", { replace: true });
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
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center font-bold text-primary text-sm tracking-tight">
            {BRAND_MONOGRAM}
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold leading-tight">{BRAND_LEGAL_NAME}</div>
            <div className="text-sm text-muted-foreground">{BRAND_TAGLINE}</div>
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

        {showDesktopDownload && (
          <Card className="w-full shadow-sm mt-4 border-primary/20">
            <CardContent className="pt-5 pb-5">
              <div className="flex gap-3 items-start">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <MonitorDown className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-2 min-w-0">
                  <p className="text-sm font-medium">App de escritorio (Windows)</p>
                  <p className="text-xs text-muted-foreground">
                    Instalador <strong>Mundo di Marmi</strong> con inventario local y actualizaciones
                    automáticas.
                  </p>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <a href={DESKTOP_RELEASES_URL} target="_blank" rel="noopener noreferrer">
                      <MonitorDown className="h-4 w-4" />
                      Descargar instalador (.exe)
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
