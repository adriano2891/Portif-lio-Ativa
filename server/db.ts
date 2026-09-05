import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface VideoSettingsRecord {
  id: string;
  video_original_url: string;
  video_file_id: string;
  video_preview_url: string;
  title: string;
  subtitle: string;
  description: string;
  cover_image: string;
  is_active: boolean;
  page_name: string;
  logo_url: string;
  text_above: string;
  text_below: string;
  og_title: string;
  og_description: string;
  og_image: string;
  created_at: string;
  updated_at: string;
}

export interface VideoAnalyticsRecord {
  id: string;
  event_type: 'page_view' | 'video_play';
  session_id: string;
  created_at: string;
}

interface AdminAuthRecord {
  username: string;
  salt: string;
  password_hash: string;
  sessions: { token: string; expires_at: number }[];
}

interface DatabaseSchema {
  video_settings: VideoSettingsRecord;
  video_analytics: VideoAnalyticsRecord[];
  admin_auth: AdminAuthRecord;
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

const defaultSalt = crypto.randomBytes(16).toString('hex');
const defaultInitialPasswordHash = hashPassword('admin123', defaultSalt);

const initialDatabase: DatabaseSchema = {
  video_settings: {
    id: 'primary',
    // Um ID de vídeo de exemplo real e público no Google Drive
    video_original_url: 'https://drive.google.com/file/d/1B7L_4o6Z4Tf5zM8xR1v9X0k8m7l5j4/view',
    video_file_id: '1B7L_4o6Z4Tf5zM8xR1v9X0k8m7l5j4',
    video_preview_url: 'https://drive.google.com/file/d/1B7L_4o6Z4Tf5zM8xR1v9X0k8m7l5j4/preview',
    title: 'Apresentação Exclusiva',
    subtitle: 'Assista ao vídeo em destaque com reprodução direta e alta resolução.',
    description: 'Vídeo configurado pelo administrador para a landing page.',
    cover_image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&auto=format&fit=crop&q=80',
    is_active: true,
    page_name: 'Apresentação Oficial',
    logo_url: '',
    text_above: 'Toque para iniciar a reprodução em tela cheia com áudio e controles.',
    text_below: 'Para dúvidas, esclarecimentos ou atendimento prioritário, fale conosco.',
    og_title: 'Vídeo Oficial em Destaque',
    og_description: 'Assista agora mesmo à apresentação completa na Landing Page.',
    og_image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&auto=format&fit=crop&q=80',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  video_analytics: [
    {
      id: 'init-1',
      event_type: 'page_view',
      session_id: 'demo-init-session',
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
  admin_auth: {
    username: 'admin',
    salt: defaultSalt,
    password_hash: defaultInitialPasswordHash,
    sessions: [],
  },
};

class DatabaseManager {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadDatabase();
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        // Garantir que todos os campos existam mesclando com o padrão
        return {
          video_settings: {
            ...initialDatabase.video_settings,
            ...(parsed.video_settings || {}),
          },
          video_analytics: Array.isArray(parsed.video_analytics)
            ? parsed.video_analytics
            : initialDatabase.video_analytics,
          admin_auth: {
            ...initialDatabase.admin_auth,
            ...(parsed.admin_auth || {}),
          },
        };
      } else {
        this.saveDatabase(initialDatabase);
        return initialDatabase;
      }
    } catch (err) {
      console.error('Erro ao ler banco de dados persistente:', err);
      return initialDatabase;
    }
  }

  private saveDatabase(data: DatabaseSchema): void {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Erro ao salvar banco de dados persistente:', err);
    }
  }

  public getVideoSettings(): VideoSettingsRecord {
    return { ...this.data.video_settings };
  }

  public updateVideoSettings(updates: Partial<VideoSettingsRecord>): VideoSettingsRecord {
    this.data.video_settings = {
      ...this.data.video_settings,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.saveDatabase(this.data);
    return { ...this.data.video_settings };
  }

  public removeVideo(): VideoSettingsRecord {
    this.data.video_settings = {
      ...this.data.video_settings,
      video_original_url: '',
      video_file_id: '',
      video_preview_url: '',
      is_active: false,
      updated_at: new Date().toISOString(),
    };
    this.saveDatabase(this.data);
    return { ...this.data.video_settings };
  }

  public recordAnalytics(eventType: 'page_view' | 'video_play', sessionId: string): boolean {
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    const now = Date.now();

    // Evitar contabilizar múltiplas visualizações causadas por atualização consecutiva da mesma sessão em poucos segundos (30s)
    if (eventType === 'page_view') {
      const recentSameSessionView = this.data.video_analytics.find(
        (entry) =>
          entry.session_id === sessionId &&
          entry.event_type === 'page_view' &&
          now - new Date(entry.created_at).getTime() < 30 * 1000
      );

      if (recentSameSessionView) {
        return false; // Ignora visualização duplicada consecutiva
      }
    }

    const newRecord: VideoAnalyticsRecord = {
      id: crypto.randomUUID(),
      event_type: eventType,
      session_id: sessionId,
      created_at: new Date().toISOString(),
    };

    this.data.video_analytics.unshift(newRecord);

    // Limitar histórico a 1000 eventos para manter desempenho leve
    if (this.data.video_analytics.length > 1000) {
      this.data.video_analytics = this.data.video_analytics.slice(0, 1000);
    }

    this.saveDatabase(this.data);
    return true;
  }

  public getAnalyticsSummary() {
    const pageViews = this.data.video_analytics.filter((e) => e.event_type === 'page_view').length;
    const videoPlays = this.data.video_analytics.filter((e) => e.event_type === 'video_play').length;

    const lastEvent = this.data.video_analytics[0] || null;
    const lastAccess = lastEvent ? lastEvent.created_at : null;

    return {
      page_views: pageViews,
      video_plays: videoPlays,
      last_access: lastAccess,
      recent_events: this.data.video_analytics.slice(0, 30),
    };
  }

  public verifyAdminCredentials(username: string, passwordAttempt: string): boolean {
    if (username !== this.data.admin_auth.username) {
      return false;
    }
    const hash = hashPassword(passwordAttempt, this.data.admin_auth.salt);
    return hash === this.data.admin_auth.password_hash;
  }

  public createSession(): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 dias de validade

    // Limpar sessões expiradas
    this.data.admin_auth.sessions = this.data.admin_auth.sessions.filter(
      (s) => s.expires_at > Date.now()
    );

    this.data.admin_auth.sessions.push({
      token,
      expires_at: expiresAt,
    });

    this.saveDatabase(this.data);
    return token;
  }

  public validateSession(token: string): boolean {
    if (!token) return false;
    const session = this.data.admin_auth.sessions.find(
      (s) => s.token === token && s.expires_at > Date.now()
    );
    return !!session;
  }

  public invalidateSession(token: string): void {
    this.data.admin_auth.sessions = this.data.admin_auth.sessions.filter((s) => s.token !== token);
    this.saveDatabase(this.data);
  }

  public updateAdminPassword(newPassword: string): void {
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashPassword(newPassword, newSalt);

    this.data.admin_auth.salt = newSalt;
    this.data.admin_auth.password_hash = newHash;
    // Invalidar sessões antigas
    this.data.admin_auth.sessions = [];
    this.saveDatabase(this.data);
  }
}

export const db = new DatabaseManager();
