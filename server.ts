import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Middleware de Autenticação Administrativa
  function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.admin_token) {
      token = req.cookies.admin_token;
    }

    if (!token || !db.validateSession(token)) {
      return res.status(401).json({
        success: false,
        error: 'Acesso não autorizado. Por favor faça login.',
      });
    }

    next();
  }

  // --- ROTAS DA API ---

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // --- Rotas Públicas ---

  // Obter configurações públicas do vídeo e da landing page
  app.get('/api/public/video', (_req, res) => {
    const settings = db.getVideoSettings();
    // Envia apenas informações públicas
    res.json({
      success: true,
      data: {
        id: settings.id,
        is_active: settings.is_active,
        video_original_url: settings.video_original_url,
        video_file_id: settings.video_file_id,
        video_preview_url: settings.video_preview_url,
        title: settings.title,
        subtitle: settings.subtitle,
        description: settings.description,
        cover_image: settings.cover_image,
        page_name: settings.page_name,
        logo_url: settings.logo_url,
        text_above: settings.text_above,
        text_below: settings.text_below,
        og_title: settings.og_title,
        og_description: settings.og_description,
        og_image: settings.og_image,
        updated_at: settings.updated_at,
      },
    });
  });

  // Registrar métricas de visualização ou clique de reprodução
  app.post('/api/public/analytics', (req, res) => {
    const { event_type, session_id } = req.body;

    if (!event_type || !['page_view', 'video_play'].includes(event_type)) {
      return res.status(400).json({ success: false, error: 'Tipo de evento inválido.' });
    }

    const recorded = db.recordAnalytics(event_type, session_id || 'anonymous');
    res.json({ success: true, recorded });
  });

  // Cache em memória para resolução de URLs diretas de imagem (ImgBB, etc.)
  const imageResolutionCache = new Map<string, string>();

  async function resolveDirectImageUrl(url: string | null | undefined): Promise<string> {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';

    if (imageResolutionCache.has(trimmed)) {
      return imageResolutionCache.get(trimmed)!;
    }

    // Se já for imagem direta do ImgBB (i.ibb.co)
    if (/^https?:\/\/i\.ibb\.co\//i.test(trimmed)) {
      imageResolutionCache.set(trimmed, trimmed);
      return trimmed;
    }

    // Se for página de visualização do ImgBB (ex: https://ibb.co/0pY01RJb)
    if (/^https?:\/\/ibb\.co\/[a-zA-Z0-9_-]+/i.test(trimmed)) {
      try {
        const resp = await fetch(trimmed, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (resp.ok) {
          const html = await resp.text();
          const ogMatch = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                          html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
          if (ogMatch && ogMatch[1]) {
            const directUrl = ogMatch[1].trim();
            imageResolutionCache.set(trimmed, directUrl);
            return directUrl;
          }
        }
      } catch (e) {
        console.warn('Falha ao resolver link do ImgBB:', e);
      }
    }

    // Se for link do Google Drive para imagem
    const driveMatch = trimmed.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=)|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]{20,60})/i);
    if (driveMatch && driveMatch[1]) {
      const directUrl = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
      imageResolutionCache.set(trimmed, directUrl);
      return directUrl;
    }

    imageResolutionCache.set(trimmed, trimmed);
    return trimmed;
  }

  // Rota de proxy / redirecionamento para imagens (resolve ibb.co para a imagem direta)
  app.get('/api/public/image-proxy', async (req: Request, res: Response) => {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).send('URL de imagem obrigatória');
    }

    const trimmed = rawUrl.trim();
    try {
      const directUrl = await resolveDirectImageUrl(trimmed);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.redirect(302, directUrl);
    } catch (err) {
      console.error('Erro no proxy de imagem:', err);
      return res.redirect(302, trimmed);
    }
  });

  // Rota para o frontend obter a URL direta de uma imagem sob demanda
  app.get('/api/public/resolve-image', async (req: Request, res: Response) => {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'URL obrigatória' });
    }
    const resolved = await resolveDirectImageUrl(rawUrl);
    return res.json({ success: true, url: resolved });
  });

  // Rota de Streaming Direto de Vídeo (HTML5 Player)
  // Resolve o problema do Google Drive exibir mensagem "Em processamento / Download"
  app.get('/api/public/video-stream/:fileId', async (req: Request, res: Response) => {
    const { fileId } = req.params;
    if (!fileId || !/^[a-zA-Z0-9_-]{15,65}$/.test(fileId)) {
      return res.status(400).send('ID de arquivo inválido.');
    }

    try {
      const driveUrls = [
        `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
        `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`
      ];

      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };

      if (req.headers.range) {
        fetchHeaders['Range'] = req.headers.range as string;
      }

      let driveRes: globalThis.Response | null = null;

      for (const targetUrl of driveUrls) {
        try {
          const resp = await fetch(targetUrl, {
            headers: fetchHeaders,
            redirect: 'follow',
          });
          if (resp.ok || resp.status === 206) {
            driveRes = resp;
            break;
          }
        } catch {
          // tentar próximo endpoint do Drive
        }
      }

      if (!driveRes || (!driveRes.ok && driveRes.status !== 206)) {
        return res.status(driveRes ? driveRes.status : 502).send('Não foi possível obter o stream de vídeo do Google Drive.');
      }

      res.status(driveRes.status);

      const contentType = driveRes.headers.get('content-type') || 'video/mp4';
      const contentLength = driveRes.headers.get('content-length');
      const contentRange = driveRes.headers.get('content-range');
      const acceptRanges = driveRes.headers.get('accept-ranges') || 'bytes';

      res.setHeader('Content-Type', contentType.includes('video') ? contentType : 'video/mp4');
      res.setHeader('Accept-Ranges', acceptRanges);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      res.setHeader('Cache-Control', 'public, max-age=7200');

      if (driveRes.body) {
        // @ts-ignore
        const nodeStream = Readable.fromWeb(driveRes.body);
        req.on('close', () => {
          nodeStream.destroy();
        });
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      console.error('Erro no streaming de vídeo:', err);
      if (!res.headersSent) {
        res.status(500).send('Erro interno ao reproduzir vídeo.');
      }
    }
  });

  // --- Rotas Administrativas ---

  // Login de Administrador
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Informe usuário e senha.' });
    }

    const isValid = db.verifyAdminCredentials(username, password);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Usuário ou senha incorretos.' });
    }

    const token = db.createSession();

    // Enviar cookie e resposta JSON com token
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: 'Login realizado com sucesso.',
      token,
      username,
    });
  });

  // Verificar status de autenticação
  app.get('/api/admin/check-auth', (req, res) => {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.admin_token) {
      token = req.cookies.admin_token;
    }

    const isAuthenticated = token ? db.validateSession(token) : false;
    res.json({
      success: true,
      authenticated: isAuthenticated,
      username: isAuthenticated ? 'admin' : null,
    });
  });

  // Logout do Administrador
  app.post('/api/admin/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.admin_token) {
      token = req.cookies.admin_token;
    }

    if (token) {
      db.invalidateSession(token);
    }

    res.clearCookie('admin_token');
    res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
  });

  // Obter configurações completas (Admin)
  app.get('/api/admin/video-settings', requireAdminAuth, (_req, res) => {
    const settings = db.getVideoSettings();
    res.json({ success: true, data: settings });
  });

  // Salvar/Atualizar configurações do vídeo ou da landing page
  app.post('/api/admin/video-settings', requireAdminAuth, async (req, res) => {
    const updates = { ...req.body };

    // Sanitizar e resolver URLs de imagem automaticamente (ImgBB, etc.)
    if (typeof updates.cover_image === 'string' && updates.cover_image.trim()) {
      updates.cover_image = await resolveDirectImageUrl(updates.cover_image.trim());
    }
    if (typeof updates.logo_url === 'string' && updates.logo_url.trim()) {
      updates.logo_url = await resolveDirectImageUrl(updates.logo_url.trim());
    }
    if (typeof updates.og_image === 'string' && updates.og_image.trim()) {
      updates.og_image = await resolveDirectImageUrl(updates.og_image.trim());
    }

    const updated = db.updateVideoSettings(updates);
    res.json({
      success: true,
      message: updates.video_preview_url ? 'Vídeo publicado com sucesso.' : 'Alterações salvas com sucesso.',
      data: updated,
    });
  });

  // Remover vídeo
  app.post('/api/admin/remove-video', requireAdminAuth, (_req, res) => {
    const updated = db.removeVideo();
    res.json({
      success: true,
      message: 'Vídeo removido com sucesso.',
      data: updated,
    });
  });

  // Obter estatísticas analíticas (Admin)
  app.get('/api/admin/analytics', requireAdminAuth, (_req, res) => {
    const summary = db.getAnalyticsSummary();
    res.json({ success: true, data: summary });
  });

  // Alterar senha do Administrador
  app.post('/api/admin/change-password', requireAdminAuth, (req, res) => {
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    if (!db.verifyAdminCredentials('admin', current_password)) {
      return res.status(400).json({ success: false, error: 'Senha atual incorreta.' });
    }

    db.updateAdminPassword(new_password);
    const newToken = db.createSession();

    res.cookie('admin_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: 'Senha alterada com sucesso.',
      token: newToken,
    });
  });

  // Dynamic Open Graph / SEO tags injection helper
  function injectMetaTags(html: string): string {
    const settings = db.getVideoSettings();
    const title = settings.og_title || settings.title || 'Landing Page de Vídeo';
    const description = settings.og_description || settings.subtitle || 'Assista ao vídeo em destaque.';
    const rawImage = (settings.og_image || settings.cover_image || 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&auto=format&fit=crop&q=80').trim();
    const image = imageResolutionCache.get(rawImage) || rawImage;

    return html
      .replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
      .replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${title}" />`)
      .replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${description}" />`)
      .replace(/<meta property="og:image" content=".*?" \/>/i, `<meta property="og:image" content="${image}" />`)
      .replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${description}" />`);
  }

  // Servir arquivos estáticos públicos (ex: video.mp4, assets)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // --- VITE MIDDLEWARE (Dev) / STATIC (Prod) ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Custom interceptor for HTML to provide dynamic OG tags even in dev
    app.use(async (req, res, next) => {
      // Let Vite handle non-HTML requests
      const isHtmlRequest = !req.url.includes('.') && (req.headers.accept?.includes('text/html') || req.url === '/' || req.url === '/admin');
      if (!isHtmlRequest || req.url.startsWith('/api')) {
        return vite.middlewares(req, res, next);
      }

      try {
        const template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, template);
        const withMeta = injectMetaTags(transformed);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(withMeta);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));

    app.get('*', (_req, res) => {
      try {
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          const html = fs.readFileSync(indexPath, 'utf-8');
          res.send(injectMetaTags(html));
        } else {
          res.sendFile(indexPath);
        }
      } catch (err) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Landing Page Server rodando na porta ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
});
