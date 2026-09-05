import React, { useState, useEffect } from 'react';
import { VideoSettings, AnalyticsSummary } from '../types';
import {
  getAdminSettings,
  saveAdminSettings,
  removeAdminVideo,
  getAdminAnalytics,
  adminLogout,
  changeAdminPassword,
  resolveImageUrlApi,
  isLocalSession,
} from '../services/api';
import { VideoPlayer } from './VideoPlayer';
import { parseGoogleDriveVideoUrl } from '../utils/googleDrive';
import { normalizeImageUrl } from '../utils/imageUrl';
import {
  Video,
  Settings,
  BarChart3,
  Share2,
  Lock,
  LogOut,
  ExternalLink,
  Save,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Eye,
  RefreshCw,
  Clock,
  Play,
  Monitor,
  Sparkles,
  Layers,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigatePublic: () => void;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigatePublic, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'video' | 'settings' | 'analytics' | 'share' | 'security'>('video');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dados do formulário de vídeo
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewEmbedUrl, setPreviewEmbedUrl] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Dados completos da página e vídeo
  const [settings, setSettings] = useState<VideoSettings | null>(null);

  // Métricas
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Link copiado feedback
  const [copiedLink, setCopiedLink] = useState(false);

  // Alteração de senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // URL pública da landing page
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://seudominio.com/';

  // Carregar dados iniciais
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [fetchedSettings, fetchedAnalytics] = await Promise.all([
      getAdminSettings(),
      getAdminAnalytics(),
    ]);

    if (fetchedSettings) {
      setSettings(fetchedSettings);
      setVideoUrlInput(fetchedSettings.video_original_url || '');
      if (fetchedSettings.video_preview_url) {
        setPreviewEmbedUrl(fetchedSettings.video_preview_url);
        setPreviewId(fetchedSettings.video_file_id);
      }
    }

    if (fetchedAnalytics) {
      setAnalytics(fetchedAnalytics);
    }
    setLoading(false);
  };

  const handleRefreshAnalytics = async () => {
    setLoadingAnalytics(true);
    const updated = await getAdminAnalytics();
    if (updated) {
      setAnalytics(updated);
    }
    setLoadingAnalytics(false);
  };

  // Validar link do Google Drive em tempo real ou ao clicar em Visualizar
  const handleValidateVideoUrl = (url: string) => {
    setParseError(null);
    if (!url.trim()) {
      setPreviewId(null);
      setPreviewEmbedUrl(null);
      return;
    }

    const result = parseGoogleDriveVideoUrl(url);
    if (result.isValid && result.previewUrl && result.fileId) {
      setPreviewId(result.fileId);
      setPreviewEmbedUrl(result.previewUrl);
      setParseError(null);
    } else {
      setParseError(result.errorMessage || 'Link inválido do Google Drive.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setVideoUrlInput(val);
    handleValidateVideoUrl(val);
  };

  // Salvar Vídeo (Requisito 5 & 7)
  const handleSaveVideo = async () => {
    setFeedbackMessage(null);
    const result = parseGoogleDriveVideoUrl(videoUrlInput);

    if (!result.isValid || !result.previewUrl || !result.fileId) {
      setFeedbackMessage({
        type: 'error',
        text: result.errorMessage || 'Por favor, informe um link válido do Google Drive.',
      });
      return;
    }

    setSaving(true);
    const response = await saveAdminSettings({
      video_original_url: videoUrlInput.trim(),
      video_file_id: result.fileId,
      video_preview_url: result.previewUrl,
      is_active: true,
    });
    setSaving(false);

    if (response.success && response.data) {
      setSettings(response.data);
      setFeedbackMessage({
        type: 'success',
        text: 'Vídeo publicado com sucesso.',
      });
    } else {
      setFeedbackMessage({
        type: 'error',
        text: response.error || 'Erro ao salvar o vídeo no banco de dados.',
      });
    }
  };

  // Remover Vídeo (Requisito 5 & 16)
  const handleRemoveVideo = async () => {
    if (!confirm('Deseja realmente remover o vídeo? A Landing Page exibirá a mensagem "Conteúdo em breve."')) {
      return;
    }

    setSaving(true);
    const response = await removeAdminVideo();
    setSaving(false);

    if (response.success && response.data) {
      setSettings(response.data);
      setVideoUrlInput('');
      setPreviewId(null);
      setPreviewEmbedUrl(null);
      setFeedbackMessage({
        type: 'success',
        text: 'Vídeo removido com sucesso.',
      });
    } else {
      setFeedbackMessage({
        type: 'error',
        text: response.error || 'Erro ao remover vídeo.',
      });
    }
  };

  // Salvar Configurações da Página (Requisito 9 & 12)
  const handleSavePageSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    const response = await saveAdminSettings({
      title: settings.title,
      subtitle: settings.subtitle,
      page_name: settings.page_name,
      logo_url: settings.logo_url,
      text_above: settings.text_above,
      text_below: settings.text_below,
      cover_image: settings.cover_image,
      og_title: settings.og_title,
      og_description: settings.og_description,
      og_image: settings.og_image,
    });
    setSaving(false);

    if (response.success && response.data) {
      setSettings(response.data);
      setFeedbackMessage({
        type: 'success',
        text: 'Configurações da página salvas com sucesso.',
      });
    } else {
      setFeedbackMessage({
        type: 'error',
        text: response.error || 'Erro ao salvar alterações.',
      });
    }
  };

  // Copiar Link Público (Requisito 11)
  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Alterar senha
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    const res = await changeAdminPassword(currentPassword, newPassword);
    if (res.success) {
      setPasswordMsg({ type: 'success', text: 'Senha alterada com sucesso!' });
      setCurrentPassword('');
      setNewPassword('');
    } else {
      setPasswordMsg({ type: 'error', text: res.error || 'Não foi possível alterar a senha.' });
    }
  };

  const handleLogoutClick = async () => {
    await adminLogout();
    onLogout();
  };

  // Formatar data relativa ou absoluta em português
  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Nenhum acesso registrado';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar do Admin */}
      <header className="w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-white text-sm tracking-tight block">
                Painel Administrativo
              </span>
              {isLocalSession() ? (
                <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1" title="Rodando em modo estático/local (Netlify). Alterações salvas localmente.">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Modo Local (Netlify)
                </span>
              ) : (
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Banco de dados conectado
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onNavigatePublic}
              id="btn-admin-view-landing"
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver Landing Page</span>
            </button>

            <button
              onClick={handleLogoutClick}
              id="btn-admin-logout"
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors flex items-center gap-1.5"
              title="Sair do painel"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mensagem Global de Feedback */}
      {feedbackMessage && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 w-full">
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm animate-in fade-in duration-200 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-red-950/40 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-black/30"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo do Painel */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row gap-6">
        {/* Barra Lateral de Navegação das Abas */}
        <aside className="w-full md:w-60 shrink-0">
          <nav className="flex md:flex-col gap-1 p-1 bg-slate-900/60 border border-slate-800 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveTab('video')}
              id="tab-video"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'video'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Configuração do Vídeo</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              id="tab-settings"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configurações da Página</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              id="tab-analytics"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Métricas & Acessos</span>
            </button>

            <button
              onClick={() => setActiveTab('share')}
              id="tab-share"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'share'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>Compartilhar & WhatsApp</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              id="tab-security"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'security'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Segurança da Senha</span>
            </button>
          </nav>

          {/* Card Resumo do Status do Vídeo */}
          <div className="hidden md:block mt-6 p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-2">
            <span className="font-semibold text-slate-300 block">Status Atual:</span>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  settings?.is_active && settings?.video_preview_url ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-200">
                {settings?.is_active && settings?.video_preview_url
                  ? 'Vídeo Ativo na Página'
                  : 'Nenhum vídeo publicado'}
              </span>
            </div>
            {settings?.updated_at && (
              <p className="text-[11px] text-slate-500 pt-1">
                Última atualização: {formatDate(settings.updated_at)}
              </p>
            )}
          </div>
        </aside>

        {/* Área Principal de Configuração */}
        <main className="flex-1">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Carregando configurações...</p>
            </div>
          ) : (
            <>
              {/* ABA 1: CONFIGURAÇÃO DO VÍDEO & PRÉ-VISUALIZAÇÃO */}
              {activeTab === 'video' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Card de Configuração do Google Drive (Requisito 5) */}
                  <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-5">
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        <Video className="w-5 h-5 text-indigo-400" />
                        <span>Configuração do Vídeo</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Insira o link de compartilhamento de qualquer vídeo hospedado no Google Drive.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label
                        className="block text-xs font-semibold text-slate-300"
                        htmlFor="drive-url-input"
                      >
                        Link do vídeo no Google Drive
                      </label>

                      <div className="relative">
                        <input
                          id="drive-url-input"
                          type="text"
                          value={videoUrlInput}
                          onChange={handleInputChange}
                          placeholder="https://drive.google.com/file/d/..."
                          className={`w-full px-4 py-3 rounded-xl bg-slate-950/80 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono ${
                            parseError ? 'border-red-500/80 focus:border-red-500' : 'border-slate-700'
                          }`}
                        />
                      </div>

                      {/* Mensagem de Erro de Validação */}
                      {parseError && (
                        <div className="flex items-start gap-2 text-xs text-red-400 pt-1">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{parseError}</span>
                        </div>
                      )}

                      {/* Sucesso de Validação & ID Extraído */}
                      {previewId && !parseError && (
                        <div className="flex items-center gap-2 text-xs text-emerald-400 pt-1">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>
                            ID identificado com sucesso:{' '}
                            <code className="bg-emerald-950/60 px-1.5 py-0.5 rounded text-emerald-300 font-mono">
                              {previewId}
                            </code>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Botões de Ação (Requisito 5) */}
                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleValidateVideoUrl(videoUrlInput)}
                        id="btn-admin-visualizar"
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs sm:text-sm transition-colors border border-slate-700 flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Visualizar</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveVideo}
                        disabled={saving || !videoUrlInput.trim()}
                        id="btn-admin-salvar-video"
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Salvando...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Salvar vídeo</span>
                          </>
                        )}
                      </button>

                      {settings?.video_preview_url && (
                        <button
                          type="button"
                          onClick={handleRemoveVideo}
                          disabled={saving}
                          id="btn-admin-remover-video"
                          className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-medium text-xs sm:text-sm transition-colors border border-red-500/20 flex items-center gap-2 ml-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Remover vídeo</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* PRÉ-VISUALIZAÇÃO (Requisito 6) */}
                  <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                          <Monitor className="w-4 h-4 text-indigo-400" />
                          <span>Pré-visualização</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Verifique se o player e as permissões do Google Drive estão funcionando perfeitamente antes de publicar.
                        </p>
                      </div>

                      {previewEmbedUrl && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                          16:9 Pronto
                        </span>
                      )}
                    </div>

                    {previewEmbedUrl ? (
                      <div className="space-y-3">
                        <div className="w-full">
                          <VideoPlayer
                            previewUrl={previewEmbedUrl}
                            originalUrl={videoUrlInput}
                            fileId={previewId || undefined}
                            coverImage={settings?.cover_image}
                            title={settings?.title || 'Pré-visualização do Vídeo'}
                          />
                        </div>

                        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-slate-200 font-medium">URL de reprodução gerada:</p>
                            <code className="text-slate-400 text-[11px] break-all font-mono">
                              {previewEmbedUrl}
                            </code>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-video rounded-xl bg-slate-950/60 border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-500 p-6 text-center space-y-2">
                        <Video className="w-8 h-8 stroke-[1.5] text-slate-600" />
                        <p className="text-xs text-slate-400 font-medium">
                          Nenhum vídeo carregado na pré-visualização.
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-sm">
                          Cole o link do Google Drive no campo acima para carregar a prévia instantânea.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ABA 2: CONFIGURAÇÕES DA PÁGINA (Requisito 9) */}
              {activeTab === 'settings' && settings && (
                <form onSubmit={handleSavePageSettings} className="space-y-6 animate-in fade-in duration-150">
                  <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-5">
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-400" />
                        <span>Configurações da Página</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Personalize os títulos, textos e elementos visuais da sua Landing Page. Todos os campos são opcionais.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Nome do Projeto / Marca */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="field-page-name">
                          Nome da página / Projeto
                        </label>
                        <input
                          id="field-page-name"
                          type="text"
                          value={settings.page_name || ''}
                          onChange={(e) => setSettings({ ...settings, page_name: e.target.value })}
                          placeholder="Ex: Apresentação Oficial"
                          className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Título da Página */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="field-title">
                          Título da página
                        </label>
                        <input
                          id="field-title"
                          type="text"
                          value={settings.title || ''}
                          onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                          placeholder="Ex: Apresentação Exclusiva"
                          className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Subtítulo */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="field-subtitle">
                          Subtítulo
                        </label>
                        <input
                          id="field-subtitle"
                          type="text"
                          value={settings.subtitle || ''}
                          onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                          placeholder="Ex: Conheça todos os detalhes no vídeo abaixo"
                          className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Logo (URL) */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="field-logo">
                          Logo (URL da Imagem)
                        </label>
                        <input
                          id="field-logo"
                          type="text"
                          value={settings.logo_url || ''}
                          onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                          placeholder="https://exemplo.com/logo.png"
                          className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          Se deixado em branco, será exibido o ícone moderno padrão do projeto.
                        </p>
                      </div>

                      {/* Imagem de Capa do Player */}
                      <div className="sm:col-span-2 space-y-2">
                        <label className="block text-xs font-semibold text-slate-300" htmlFor="field-cover">
                          Imagem de capa / Poster do vídeo (URL)
                        </label>
                        <input
                          id="field-cover"
                          type="text"
                          value={settings.cover_image || ''}
                          onChange={(e) => setSettings({ ...settings, cover_image: e.target.value })}
                          onBlur={async (e) => {
                            const val = e.target.value.trim();
                            if (val && /^https?:\/\/ibb\.co\//i.test(val)) {
                              const resolved = await resolveImageUrlApi(val);
                              if (resolved && resolved !== val) {
                                setSettings({ ...settings, cover_image: resolved });
                              }
                            }
                          }}
                          placeholder="https://images.unsplash.com/... ou link do ImgBB"
                          className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono text-xs"
                        />
                        <p className="text-[11px] text-slate-500">
                          Suporta links diretos, links do ImgBB (ibb.co) e Google Drive. Links do ImgBB são convertidos automaticamente.
                        </p>
                        {settings.cover_image && (
                          <div className="mt-2 flex items-center gap-3 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                            <div className="w-16 h-10 rounded overflow-hidden bg-black shrink-0 border border-slate-700">
                              <img
                                src={normalizeImageUrl(settings.cover_image)}
                                alt="Miniatura da Capa"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-400 truncate">
                              Prévia da imagem de capa carregada
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Texto Acima do Vídeo */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="field-text-above">
                          Texto acima do vídeo
                        </label>
                        <input
                          id="field-text-above"
                          type="text"
                          value={settings.text_above || ''}
                          onChange={(e) => setSettings({ ...settings, text_above: e.target.value })}
                          placeholder="Ex: Aperte o play para assistir à transmissão completa"
                          className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Texto Abaixo do Vídeo */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="field-text-below">
                          Texto abaixo do vídeo
                        </label>
                        <textarea
                          id="field-text-below"
                          rows={3}
                          value={settings.text_below || ''}
                          onChange={(e) => setSettings({ ...settings, text_below: e.target.value })}
                          placeholder="Ex: Para dúvidas ou maiores informações, entre em contato com nossa equipe."
                          className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={saving}
                        id="btn-admin-salvar-alteracoes"
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                      >
                        {saving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Salvando alterações...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Salvar alterações</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* ABA 3: CONTADOR DE VISUALIZAÇÕES & ANALYTICS (Requisito 10) */}
              {activeTab === 'analytics' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-400" />
                        <span>Métricas de Acesso</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Dados persistidos de visitantes e interações com o vídeo.
                      </p>
                    </div>

                    <button
                      onClick={handleRefreshAnalytics}
                      disabled={loadingAnalytics}
                      id="btn-refresh-analytics"
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
                      <span>Atualizar</span>
                    </button>
                  </div>

                  {/* CARDS SOLICITADOS (Requisito 10): VISUALIZAÇÕES, REPRODUÇÕES, ÚLTIMO ACESSO */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Card: VISUALIZAÇÕES */}
                    <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl relative overflow-hidden">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                          VISUALIZAÇÕES
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                        {analytics?.page_views ?? 0}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2">
                        Visualizações únicas da Landing Page
                      </p>
                    </div>

                    {/* Card: REPRODUÇÕES */}
                    <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl relative overflow-hidden">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                          REPRODUÇÕES
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                          <Play className="w-4 h-4 fill-emerald-400" />
                        </div>
                      </div>
                      <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                        {analytics?.video_plays ?? 0}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2">
                        Cliques para iniciar o vídeo
                      </p>
                    </div>

                    {/* Card: ÚLTIMO ACESSO */}
                    <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl relative overflow-hidden">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
                          ÚLTIMO ACESSO
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                          <Clock className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-sm sm:text-base font-bold text-white tracking-tight pt-1">
                        {analytics?.last_access ? formatDate(analytics.last_access) : 'Nenhum ainda'}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2">
                        Data e hora do último evento registrado
                      </p>
                    </div>
                  </div>

                  {/* Tabela de Eventos Recentes */}
                  <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl">
                    <h3 className="text-sm font-bold text-white mb-3">Histórico de Eventos Recentes</h3>
                    {analytics?.recent_events && analytics.recent_events.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="py-2.5 px-3">Tipo de Evento</th>
                              <th className="py-2.5 px-3">Sessão</th>
                              <th className="py-2.5 px-3">Data e Hora</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono">
                            {analytics.recent_events.map((ev) => (
                              <tr key={ev.id} className="hover:bg-slate-800/30">
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-sans font-medium ${
                                      ev.event_type === 'video_play'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                    }`}
                                  >
                                    {ev.event_type === 'video_play' ? '▶ Reprodução' : '👁 Visualização'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-[140px]">
                                  {ev.session_id}
                                </td>
                                <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                                  {formatDate(ev.created_at)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 py-4 text-center">Nenhum evento registrado ainda.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ABA 4: COMPARTILHAMENTO & WHATSAPP (Requisitos 11 & 12) */}
              {activeTab === 'share' && settings && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Seção Link Público (Requisito 11) */}
                  <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-indigo-400" />
                        <span>Link Público da Landing Page</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Copie o endereço da página para compartilhar com seus clientes e visitantes.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="flex-1 px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700 text-sm text-slate-200 font-mono select-all truncate">
                        {publicUrl}
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyLink}
                        id="btn-copiar-link"
                        className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 shrink-0"
                      >
                        {copiedLink ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                            <span>Link copiado.</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copiar link</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Seção WhatsApp / Open Graph (Requisito 12) */}
                  <form onSubmit={handleSavePageSettings} className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-5">
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-emerald-400" />
                        <span>Visualização no WhatsApp & Redes Sociais</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Configure o título, descrição e imagem que aparecerão automaticamente quando você enviar o link no WhatsApp.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="field-og-title">
                          Título de compartilhamento
                        </label>
                        <input
                          id="field-og-title"
                          type="text"
                          value={settings.og_title || ''}
                          onChange={(e) => setSettings({ ...settings, og_title: e.target.value })}
                          placeholder="Ex: Assista à Apresentação Exclusiva"
                          className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="field-og-desc">
                          Descrição
                        </label>
                        <textarea
                          id="field-og-desc"
                          rows={2}
                          value={settings.og_description || ''}
                          onChange={(e) => setSettings({ ...settings, og_description: e.target.value })}
                          placeholder="Ex: Assista agora mesmo ao vídeo oficial em alta resolução."
                          className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="field-og-img">
                          Imagem de capa (URL)
                        </label>
                        <input
                          id="field-og-img"
                          type="text"
                          value={settings.og_image || ''}
                          onChange={(e) => setSettings({ ...settings, og_image: e.target.value })}
                          onBlur={async (e) => {
                            const val = e.target.value.trim();
                            if (val && /^https?:\/\/ibb\.co\//i.test(val)) {
                              const resolved = await resolveImageUrlApi(val);
                              if (resolved && resolved !== val) {
                                setSettings({ ...settings, og_image: resolved });
                              }
                            }
                          }}
                          placeholder="https://exemplo.com/capa-whatsapp.jpg ou link do ImgBB"
                          className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Simulação Visual do Card do WhatsApp */}
                    <div className="pt-2">
                      <span className="block text-xs font-semibold text-slate-400 mb-2">
                        Prévia da mensagem no WhatsApp:
                      </span>
                      <div className="max-w-sm rounded-xl overflow-hidden bg-[#1f2c34] border border-[#2a3942] p-2.5 text-white shadow-lg space-y-2">
                        {settings.og_image && (
                          <div className="w-full h-36 rounded-lg overflow-hidden bg-[#111b21]">
                            <img
                              src={normalizeImageUrl(settings.og_image)}
                              alt="Prévia WhatsApp"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <div className="px-1 space-y-1">
                          <p className="text-xs font-bold text-slate-100 line-clamp-1">
                            {settings.og_title || settings.title || 'Landing Page de Vídeo'}
                          </p>
                          <p className="text-[11px] text-[#8696a0] line-clamp-2 leading-relaxed">
                            {settings.og_description || settings.subtitle || 'Assista ao vídeo em destaque.'}
                          </p>
                          <p className="text-[10px] text-[#8696a0] pt-0.5 truncate">
                            {publicUrl.replace('https://', '')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        <span>Salvar configurações de compartilhamento</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ABA 5: SEGURANÇA DA SENHA (Requisito 17) */}
              {activeTab === 'security' && (
                <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-5 animate-in fade-in duration-150 max-w-lg">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <Lock className="w-5 h-5 text-indigo-400" />
                      <span>Segurança da Conta do Administrador</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Altere a senha de acesso ao Painel Administrativo.
                    </p>
                  </div>

                  {passwordMsg && (
                    <div
                      className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                        passwordMsg.type === 'success'
                          ? 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-300'
                          : 'bg-red-950/50 border border-red-500/30 text-red-300'
                      }`}
                    >
                      {passwordMsg.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{passwordMsg.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="current-pw">
                        Senha Atual
                      </label>
                      <input
                        id="current-pw"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="new-pw">
                        Nova Senha (mínimo 6 caracteres)
                      </label>
                      <input
                        id="new-pw"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <button
                      type="submit"
                      id="btn-alterar-senha"
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Atualizar Senha</span>
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
