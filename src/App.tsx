/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PublicLanding } from './components/PublicLanding';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { checkAdminAuth } from './services/api';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Sincronizar rota com a URL do navegador
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.startsWith('/admin') || hash === '#admin') {
        setCurrentPath('/admin');
      } else {
        setCurrentPath('/');
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Verificar status de autenticação
  useEffect(() => {
    const verifyAuth = async () => {
      setCheckingAuth(true);
      const authed = await checkAdminAuth();
      setIsAuthenticated(authed);
      setCheckingAuth(false);
    };

    verifyAuth();
  }, [currentPath]);

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    try {
      window.history.pushState({}, '', path);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 font-sans antialiased">
      {/* Roteamento Principal */}
      {currentPath === '/admin' ? (
        checkingAuth ? (
          <div className="min-h-screen flex items-center justify-center bg-[#090a0f]">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isAuthenticated ? (
          <AdminDashboard
            onNavigatePublic={() => navigateTo('/')}
            onLogout={() => {
              setIsAuthenticated(false);
              navigateTo('/admin');
            }}
          />
        ) : (
          <AdminLogin
            onLoginSuccess={() => {
              setIsAuthenticated(true);
              navigateTo('/admin');
            }}
            onNavigateBack={() => navigateTo('/')}
          />
        )
      ) : (
        <PublicLanding onNavigateAdmin={() => navigateTo('/admin')} />
      )}
    </div>
  );
}
