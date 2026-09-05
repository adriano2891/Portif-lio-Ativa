import { ApiResponse, VideoSettings, AnalyticsSummary, EventType } from '../types';

export const API_BASE = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');

const TOKEN_KEY = 'admin_auth_token';
const LOCAL_SETTINGS_KEY = 'local_video_settings';
const LOCAL_PASS_KEY = 'local_admin_password';
const LOCAL_EVENTS_KEY = 'local_analytics_events';

// Configurações padrão iniciais caso o backend não esteja disponível (modo estático/Netlify)
export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  id: 'primary',
  video_original_url: 'https://drive.google.com/file/d/1imCug0lfQ1_R-VbGCLXMspYUzVH-5PuF/view?usp=sharing',
  video_file_id: '1imCug0lfQ1_R-VbGCLXMspYUzVH-5PuF',
  video_preview_url: 'https://drive.google.com/file/d/1imCug0lfQ1_R-VbGCLXMspYUzVH-5PuF/preview',
  title: 'Demonstração Oficial 2026',
  subtitle: '',
  description: 'Vídeo configurado pelo administrador para a landing page.',
  cover_image: 'https://i.ibb.co/ZRcQvpTD/Whats-App-Video-2026-08-31-at-17-03-53-1-00-00-01.png',
  is_active: true,
  page_name: 'Apresentação Oficial',
  logo_url: '',
  text_above: 'Toque para iniciar a reprodução em tela cheia com áudio e controles.',
  text_below: 'Para dúvidas, esclarecimentos ou atendimento prioritário, fale conosco.',
  og_title: 'Vídeo Oficial em Destaque',
  og_description: 'Assista agora mesmo à apresentação completa na Landing Page.',
  og_image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&auto=format&fit=crop&q=80',
  created_at: '2026-09-03T22:39:30.903Z',
  updated_at: '2026-09-04T08:21:34.423Z',
};

// Helpers de armazenamento local (fallback para hospedagens estáticas)
export function getLocalSettings(): VideoSettings {
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_VIDEO_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_VIDEO_SETTINGS };
}

export function saveLocalSettings(settings: VideoSettings): void {
  try {
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function getLocalPassword(): string {
  try {
    return localStorage.getItem(LOCAL_PASS_KEY) || 'admin123';
  } catch {
    return 'admin123';
  }
}

export function saveLocalPassword(pass: string): void {
  try {
    localStorage.setItem(LOCAL_PASS_KEY, pass);
  } catch {}
}

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

export function isLocalSession(): boolean {
  const token = getStoredToken();
  return !!token && token.startsWith('local_token_');
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

// Parser seguro de resposta JSON (evita 'Unexpected end of JSON input')
async function parseJsonResponse<T>(res: Response): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  const status = res.status;
  try {
    const text = await res.text();
    if (!text || text.trim() === '') {
      return {
        ok: false,
        status,
        error: `O servidor retornou uma resposta vazia (HTTP ${status}). O backend Node.js não foi encontrado nesta rota.`,
      };
    }
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html') || text.includes('__vite_plugin_react_preamble_installed__')) {
      return {
        ok: false,
        status,
        error: `A rota retornou HTML em vez de JSON (HTTP ${status}). Certifique-se de que o backend Node.js está rodando.`,
      };
    }
    const json = JSON.parse(text) as T;
    return { ok: true, data: json, status };
  } catch (err: any) {
    return {
      ok: false,
      status,
      error: `Resposta inválida do servidor: ${err?.message || 'não é um JSON válido'}.`,
    };
  }
}

// Obter dados públicos do vídeo
export async function getPublicVideo(): Promise<VideoSettings | null> {
  try {
    const res = await fetch(`${API_BASE}/api/public/video`);
    const parsed = await parseJsonResponse<ApiResponse<VideoSettings>>(res);
    if (parsed.ok && parsed.data?.success && parsed.data?.data) {
      // Atualizar cache local com os dados vindos do backend
      saveLocalSettings(parsed.data.data);
      return parsed.data.data;
    }
    // Se o backend retornou erro ou não existe (ex: Netlify estático), usa fallback local
    return getLocalSettings();
  } catch {
    // Falha de rede: usa fallback local transparente
    return getLocalSettings();
  }
}

// Resolver URL de imagem direta no backend (ex: ImgBB, Google Drive)
export async function resolveImageUrlApi(url: string): Promise<string> {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  try {
    const res = await fetch(`${API_BASE}/api/public/resolve-image?url=${encodeURIComponent(trimmed)}`);
    const parsed = await parseJsonResponse<ApiResponse<{ url: string }>>(res);
    if (parsed.ok && parsed.data?.success && (parsed.data as any).url) {
      return (parsed.data as any).url;
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
  const sessionId = getOrCreateSessionId();

  // Salvar no histórico local
  try {
    const eventsRaw = localStorage.getItem(LOCAL_EVENTS_KEY);
    const events = eventsRaw ? JSON.parse(eventsRaw) : [];
    events.push({ event_type: eventType, session_id: sessionId, created_at: new Date().toISOString() });
    if (events.length > 200) events.splice(0, events.length - 200);
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
  } catch {}

  // Enviar para o backend se disponível
  try {
    const res = await fetch(`${API_BASE}/api/public/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: eventType,
        session_id: sessionId,
      }),
    });
    const parsed = await parseJsonResponse<ApiResponse>(res);
    return !!parsed.data?.success;
  } catch {
    return true; // Sucesso local registrado
  }
}

// Admin: Login
export async function adminLogin(username: string, password: string): Promise<ApiResponse<{ token: string; username: string }>> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const parsed = await parseJsonResponse<ApiResponse<{ token: string; username: string }>>(res);

    // Se o backend respondeu com sucesso ou erro de autenticação legítimo (ex: 401 ou 200 com JSON)
    if (parsed.ok && parsed.data) {
      if (parsed.data.success && parsed.data.token) {
        setStoredToken(parsed.data.token);
      }
      return parsed.data;
    }

    // Se o backend retornou 404 (rota não existe no Netlify estático) ou falhou a conexão
    if (!parsed.ok && (parsed.status === 404 || parsed.status === 405 || parsed.status === 0)) {
      // Fallback para autenticação local
      if (username.trim().toLowerCase() === 'admin' && password === getLocalPassword()) {
        const localToken = `local_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        setStoredToken(localToken);
        return {
          success: true,
          token: localToken,
          username: 'admin',
        };
      }
      return {
        success: false,
        error: 'Credenciais inválidas. (Modo Local/Netlify: usuário "admin" com a senha configurada)',
      };
    }

    return {
      success: false,
      error: parsed.error || 'Erro ao conectar ao servidor de autenticação.',
    };
  } catch {
    // Se houve erro de rede (offline ou backend ausente), usar modo local
    if (username.trim().toLowerCase() === 'admin' && password === getLocalPassword()) {
      const localToken = `local_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      setStoredToken(localToken);
      return {
        success: true,
        token: localToken,
        username: 'admin',
      };
    }
    return {
      success: false,
      error: 'Credenciais inválidas. (Modo Local/Netlify: padrão é admin / admin123)',
    };
  }
}

// Admin: Verificar se está autenticado
export async function checkAdminAuth(): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;

  // Sessão local é válida se o token local existir
  if (token.startsWith('local_token_')) {
    return true;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/check-auth`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseJsonResponse<{ authenticated: boolean }>(res);
    if (parsed.ok && parsed.data?.authenticated) {
      return true;
    }
    // Se a rota falhar (404), não desloga bruscamente se for local
    removeStoredToken();
    return false;
  } catch {
    return false;
  }
}

// Admin: Logout
export async function adminLogout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/admin/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch {}
  removeStoredToken();
}

// Admin: Obter configurações
export async function getAdminSettings(): Promise<VideoSettings | null> {
  if (isLocalSession()) {
    return getLocalSettings();
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/video-settings`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseJsonResponse<ApiResponse<VideoSettings>>(res);
    if (parsed.ok && parsed.data?.success && parsed.data?.data) {
      saveLocalSettings(parsed.data.data);
      return parsed.data.data;
    }
    return getLocalSettings();
  } catch {
    return getLocalSettings();
  }
}

// Admin: Salvar configurações
export async function saveAdminSettings(settings: Partial<VideoSettings>): Promise<ApiResponse<VideoSettings>> {
  if (isLocalSession()) {
    const current = getLocalSettings();
    const updated: VideoSettings = {
      ...current,
      ...settings,
      updated_at: new Date().toISOString(),
    };
    saveLocalSettings(updated);
    return { success: true, data: updated };
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/video-settings`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
    const parsed = await parseJsonResponse<ApiResponse<VideoSettings>>(res);
    if (parsed.ok && parsed.data) {
      if (parsed.data.data) saveLocalSettings(parsed.data.data);
      return parsed.data;
    }
    // Fallback salvando localmente
    const current = getLocalSettings();
    const updated: VideoSettings = { ...current, ...settings, updated_at: new Date().toISOString() };
    saveLocalSettings(updated);
    return { success: true, data: updated };
  } catch (err: any) {
    const current = getLocalSettings();
    const updated: VideoSettings = { ...current, ...settings, updated_at: new Date().toISOString() };
    saveLocalSettings(updated);
    return { success: true, data: updated };
  }
}

// Admin: Remover vídeo
export async function removeAdminVideo(): Promise<ApiResponse<VideoSettings>> {
  if (isLocalSession()) {
    const current = getLocalSettings();
    const updated: VideoSettings = {
      ...current,
      is_active: false,
      updated_at: new Date().toISOString(),
    };
    saveLocalSettings(updated);
    return { success: true, data: updated };
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/remove-video`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const parsed = await parseJsonResponse<ApiResponse<VideoSettings>>(res);
    if (parsed.ok && parsed.data) {
      if (parsed.data.data) saveLocalSettings(parsed.data.data);
      return parsed.data;
    }
    const current = getLocalSettings();
    const updated: VideoSettings = { ...current, is_active: false, updated_at: new Date().toISOString() };
    saveLocalSettings(updated);
    return { success: true, data: updated };
  } catch {
    const current = getLocalSettings();
    const updated: VideoSettings = { ...current, is_active: false, updated_at: new Date().toISOString() };
    saveLocalSettings(updated);
    return { success: true, data: updated };
  }
}

// Admin: Obter métricas
export async function getAdminAnalytics(): Promise<AnalyticsSummary | null> {
  if (isLocalSession()) {
    try {
      const eventsRaw = localStorage.getItem(LOCAL_EVENTS_KEY);
      const events: any[] = eventsRaw ? JSON.parse(eventsRaw) : [];
      const pageViews = events.filter((e) => e.event_type === 'page_view').length;
      const videoPlays = events.filter((e) => e.event_type === 'video_play').length;
      return {
        page_views: pageViews || 1,
        video_plays: videoPlays,
        last_access: events.length > 0 ? events[events.length - 1].created_at : null,
        recent_events: events.slice(-30).reverse(),
      };
    } catch {
      return { page_views: 1, video_plays: 0, last_access: null, recent_events: [] };
    }
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/analytics`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseJsonResponse<ApiResponse<AnalyticsSummary>>(res);
    return parsed.ok && parsed.data?.success && parsed.data?.data ? parsed.data.data : null;
  } catch {
    return { page_views: 1, video_plays: 0, last_access: null, recent_events: [] };
  }
}

// Admin: Alterar senha
export async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
  if (isLocalSession()) {
    const stored = getLocalPassword();
    if (currentPassword !== stored) {
      return { success: false, error: 'A senha atual está incorreta.' };
    }
    if (newPassword.length < 6) {
      return { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };
    }
    saveLocalPassword(newPassword);
    return { success: true };
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/change-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    const parsed = await parseJsonResponse<ApiResponse<{ token?: string }>>(res);
    if (parsed.ok && parsed.data) {
      if (parsed.data.success && (parsed.data as any).token) {
        setStoredToken((parsed.data as any).token);
      }
      return parsed.data;
    }
    return { success: false, error: parsed.error || 'Erro ao alterar senha.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao alterar senha.' };
  }
}

