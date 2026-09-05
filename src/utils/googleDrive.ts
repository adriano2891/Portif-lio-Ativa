import { GoogleDriveParseResult } from '../types';

/**
 * Identifica o ID do arquivo, valida se o link pertence ao Google Drive,
 * gera automaticamente a URL de reprodução e rejeita links inválidos.
 * 
 * Formato gerado para reprodução em iframe:
 * https://drive.google.com/file/d/{FILE_ID}/preview
 */
export function parseGoogleDriveVideoUrl(input: string): GoogleDriveParseResult {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      fileId: null,
      previewUrl: null,
      errorMessage: 'Por favor, insira o link do vídeo.',
    };
  }

  const trimmed = input.trim();

  // Caso o usuário tenha inserido diretamente o ID alfanumérico do Google Drive (geralmente entre 25 e 50 caracteres)
  const isDirectId = /^[a-zA-Z0-9_-]{25,55}$/.test(trimmed);
  if (isDirectId) {
    return {
      isValid: true,
      fileId: trimmed,
      previewUrl: `https://drive.google.com/file/d/${trimmed}/preview`,
    };
  }

  // Verificar se o domínio é do Google Drive / Docs
  const isGoogleDomain = /drive\.google\.com|docs\.google\.com/i.test(trimmed);
  if (!isGoogleDomain) {
    return {
      isValid: false,
      fileId: null,
      previewUrl: null,
      errorMessage: 'O link informado não pertence ao Google Drive. Utilize um link válido do drive.google.com.',
    };
  }

  let fileId: string | null = null;

  // Padrão 1: /file/d/{ID}/... ou /file/d/{ID}
  const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{20,60})/i);
  if (matchFileD && matchFileD[1]) {
    fileId = matchFileD[1];
  }

  // Padrão 2: id={ID} em query string (open?id=..., uc?id=..., etc.)
  if (!fileId) {
    const matchQueryId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,60})/i);
    if (matchQueryId && matchQueryId[1]) {
      fileId = matchQueryId[1];
    }
  }

  // Padrão 3: /folders/{ID} -> alertar que é pasta e não arquivo
  if (trimmed.includes('/drive/folders/') || trimmed.includes('/folders/')) {
    return {
      isValid: false,
      fileId: null,
      previewUrl: null,
      errorMessage: 'O link informado aponta para uma pasta, e não para um arquivo de vídeo individual.',
    };
  }

  if (!fileId) {
    return {
      isValid: false,
      fileId: null,
      previewUrl: null,
      errorMessage: 'Não foi possível extrair o identificador (ID) do vídeo a partir deste link do Google Drive.',
    };
  }

  return {
    isValid: true,
    fileId,
    previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
  };
}
