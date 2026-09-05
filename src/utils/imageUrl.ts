/**
 * Utilitário para normalizar URLs de imagem (ImgBB, Google Drive, etc.)
 * para que possam ser carregadas diretamente como src em <img> ou background-image em CSS.
 */
export function normalizeImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // ImgBB arquivo direto (ex: https://i.ibb.co/ZRcQvpTD/image.png)
  if (/^https?:\/\/i\.ibb\.co\//i.test(trimmed)) {
    return trimmed;
  }

  // Página de visualização do ImgBB (ex: https://ibb.co/0pY01RJb)
  // Redireciona através do proxy do servidor que extrai a URL direta da imagem
  if (/^https?:\/\/ibb\.co\/[a-zA-Z0-9_-]+/i.test(trimmed)) {
    return `/api/public/image-proxy?url=${encodeURIComponent(trimmed)}`;
  }

  // Google Drive URLs como imagem: https://drive.google.com/file/d/{id}/view -> https://lh3.googleusercontent.com/d/{id}
  const driveMatch = trimmed.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=)|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]{20,60})/i);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }

  return trimmed;
}
