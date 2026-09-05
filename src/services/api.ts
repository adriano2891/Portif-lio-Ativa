import { ApiResponse, VideoSettings, AnalyticsSummary, EventType } from '../types';

const TOKEN_KEY = 'admin_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function removeStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Obter dados públicos do vídeo
export async function getPublicVideo(): Promise<VideoSettings | null> {
  try {
    const res = await fetch('/api/public/video');
    const json: ApiResponse<VideoSettings> = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
    return null;
  } catch (err) {
    console.error('Erro ao buscar vídeo público:', err);
    return null;
  }
}

// Resolver URL de imagem direta no backend (ex: ImgBB, Google Drive)
export async function resolveImageUrlApi(url: string): Promise<string> {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  try {
    const res = await fetch(`/api/public/resolve-image?url=${encodeURIComponent(trimmed)}`);
    const json = await res.json();
    if (json.success && json.url) {
      return json.url;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

// Obter ou gerar session_id para o visitante
export function getOrCreateSessionId(): string {
  const SESSION_KEY = 'video_visitor_session_id';
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return 'fallback_session_' + Date.now();
  }
}

// Registrar evento analítico
export async function trackEvent(eventType: EventType): Promise<boolean> {
  try {
    const sessionId = getOrCreateSessionId();
    const res = await fetch('/api/public/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: eventType,
        session_id: sessionId,
      }),
    });
    const json = await res.json();
    return !!json.success;
  } catch (err) {
    console.warn('Falha ao registrar métrica:', err);
    return false;
  }
}

// Admin: Login
export async function adminLogin(username: string, password: string): Promise<ApiResponse<{ token: string; username: string }>> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (json.success && json.token) {
      setStoredToken(json.token);
    }
    return json;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro de conexão com o servidor.' };
  }
}

// Admin: Verificar se está autenticado
export async function checkAdminAuth(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/check-auth', {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.authenticated) {
      removeStoredToken();
    }
    return !!json.authenticated;
  } catch {
    return false;
  }
}

// Admin: Logout
export async function adminLogout(): Promise<void> {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch {}
  removeStoredToken();
}

// Admin: Obter configurações
export async function getAdminSettings(): Promise<VideoSettings | null> {
  try {
    const res = await fetch('/api/admin/video-settings', {
      headers: getAuthHeaders(),
    });
    const json: ApiResponse<VideoSettings> = await res.json();
    return json.success && json.data ? json.data : null;
  } catch (err) {
    console.error('Erro ao obter configurações admin:', err);
    return null;
  }
}

// Admin: Salvar configurações
export async function saveAdminSettings(settings: Partial<VideoSettings>): Promise<ApiResponse<VideoSettings>> {
  try {
    const res = await fetch('/api/admin/video-settings', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao salvar configurações.' };
  }
}

// Admin: Remover vídeo
export async function removeAdminVideo(): Promise<ApiResponse<VideoSettings>> {
  try {
    const res = await fetch('/api/admin/remove-video', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao remover vídeo.' };
  }
}

// Admin: Obter métricas
export async function getAdminAnalytics(): Promise<AnalyticsSummary | null> {
  try {
    const res = await fetch('/api/admin/analytics', {
      headers: getAuthHeaders(),
    });
    const json: ApiResponse<AnalyticsSummary> = await res.json();
    return json.success && json.data ? json.data : null;
  } catch (err) {
    console.error('Erro ao obter analytics:', err);
    return null;
  }
}

// Admin: Alterar senha
export async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
  try {
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    const json = await res.json();
    if (json.success && json.token) {
      setStoredToken(json.token);
    }
    return json;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao alterar senha.' };
  }
}
