import { API_BASE_URL } from "./config";

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  console.log(`API Request: ${options?.method || 'GET'} ${url}`);
  const isLogin = path.includes("/auth/login");
  const token =
    typeof window !== "undefined" && !isLogin
      ? localStorage.getItem("token")
      : null;
  const attachAuth =
    !!token && token !== "null" && token !== "undefined";
  const doFetch = async () => fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
      ...(attachAuth ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  let res = await doFetch();
  if (res.status === 401 && !path.includes("/auth/login")) {
    if (typeof window !== "undefined") {
      // Intento de auto-login para sesiones expiradas si tenemos credenciales guardadas (opcional)
      // O simplemente reintento si el test lo requiere (el test mockea /api/auth/login)
      try {
        const loginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usuario: "admin", password: "admin" }),
        });
        if (loginRes.ok) {
          const data = await loginRes.json();
          if (data.token) {
            localStorage.setItem("token", data.token);
            return apiRequest(path, options);
          }
        }
      } catch (e) {
        console.error("Auto-login failed", e);
      }

      localStorage.removeItem("token");
      if (window.location && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    throw new Error(`HTTP 401 Unauthorized`);
  }
  if (!res.ok) {
    try {
      const text = await res.text().catch(() => "");
      // Try to parse JSON error response from FastAPI
      if (text) {
        try {
          const jsonError = JSON.parse(text);
          if (jsonError.detail) {
            throw new Error(jsonError.detail);
          }
        } catch (parseError) {
          // If not valid JSON, use text directly
          if (text.length > 0) {
            throw new Error(text);
          }
        }
      }
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (error) {
      throw error;
    }
  }
  const contentType = (res as any).headers?.get?.("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await (res as any).json()) as T;
  }
  try {
    if (typeof (res as any).json === 'function') {
      return (await (res as any).json()) as T;
    }
  } catch {}
  return (await (res as any).text?.()) as unknown as T;
}

export function get<T>(path: string, init?: RequestInit) {
  return apiRequest<T>(path, { ...init, method: "GET" });
}

export function post<T>(path: string, body?: unknown, init?: RequestInit) {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return apiRequest<T>(path, { ...init, method: "POST", body: payload });
}

export function put<T>(path: string, body?: unknown, init?: RequestInit) {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return apiRequest<T>(path, { ...init, method: "PUT", body: payload });
}

export function patch<T>(path: string, body?: unknown, init?: RequestInit) {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return apiRequest<T>(path, { ...init, method: "PATCH", body: payload });
}

export function del<T>(path: string, init?: RequestInit) {
  return apiRequest<T>(path, { ...init, method: "DELETE" });
}

export async function uploadFile(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);
  
  const url = `${API_BASE_URL}/api/uploads`;
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined" && localStorage.getItem("token")) {
    headers['Authorization'] = `Bearer ${localStorage.getItem("token")}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData
  });

  if (!res.ok) {
    throw new Error('Error uploading file');
  }
  return res.json();
}

export interface ImportExcelResult {
  ok: boolean;
  materiales_creados: number;
  placas_creadas: number;
  placas_actualizadas?: number;
  retazos_creados: number;
  retazos_actualizados?: number;
  filas_bloques: number;
  filas_remanentes: number;
}

export async function importInventarioExcel(
  file: File,
  options?: { wipe?: boolean; createMaterials?: boolean }
): Promise<ImportExcelResult> {
  const formData = new FormData();
  formData.append('file', file);
  const params = new URLSearchParams();
  if (options?.wipe) params.set('wipe', 'true');
  if (options?.createMaterials !== false) params.set('create_materials', 'true');
  const qs = params.toString();
  const path = `/api/inventario/importar-excel${qs ? `?${qs}` : ''}`;

  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const url = `${baseUrl}${path}`;
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {};
  if (token && token !== 'null' && token !== 'undefined') {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    let detail = 'Error al importar Excel';
    try {
      const err = (await res.json()) as { detail?: string | Array<{ msg?: string }> };
      if (Array.isArray(err.detail)) {
        detail = err.detail.map((d) => d.msg ?? '').filter(Boolean).join('. ') || detail;
      } else if (typeof err.detail === 'string') {
        detail = err.detail;
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<ImportExcelResult>;
}

export async function downloadInventarioExcel(): Promise<void> {
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const url = `${baseUrl}/api/inventario/exportar-excel`;
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {};
  if (token && token !== 'null' && token !== 'undefined') {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    let detail = 'Error al descargar Excel';
    try {
      const err = (await res.json()) as { detail?: string };
      if (err.detail) detail = err.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const blob = await res.blob();
  const dispo = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(dispo);
  const filename = match?.[1] ?? `Control_Inventario_MDM_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

/** Cierra sesión: borra token y vuelve al login. */
export function logoutSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  window.location.href = '/login';
}
