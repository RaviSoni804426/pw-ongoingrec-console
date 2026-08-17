'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, tokenStore, userStore } from './api';
import { loginResponse, type Me, type Role } from './schemas';

interface AuthState {
  user: Me | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  // The token lives in localStorage, so it is only readable after mount.
  useEffect(() => {
    setUser(userStore.get<Me>());
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch('/auth/login', loginResponse, {
      method: 'POST',
      body: { email, password },
      anonymous: true,
    });

    tokenStore.set(result.accessToken);
    const me: Me = { ...result.user, teamId: null };
    userStore.set(me);
    setUser(me);
  }, []);

  /**
   * Exchanges a Google ID token for a console session.
   *
   * The token is only ever posted to our own API — the domain rule and every
   * other check happen there, on a signature-verified token. Nothing about
   * who may sign in is decided in this file.
   */
  const loginWithGoogle = useCallback(async (idToken: string) => {
    const result = await apiFetch('/auth/google', loginResponse, {
      method: 'POST',
      body: { idToken },
      anonymous: true,
    });

    tokenStore.set(result.accessToken);
    const me: Me = { ...result.user, teamId: null };
    userStore.set(me);
    setUser(me);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const result = await apiFetch('/auth/signup', loginResponse, {
      method: 'POST',
      body: { name, email, password },
      anonymous: true,
    });

    tokenStore.set(result.accessToken);
    const me: Me = { ...result.user, teamId: null };
    userStore.set(me);
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    router.push('/login');
  }, [router]);

  const hasRole = useCallback(
    (...roles: Role[]) => Boolean(user && roles.some((r) => user.roles.includes(r))),
    [user],
  );

  const value = useMemo<AuthState>(
    () => ({ user, ready, login, loginWithGoogle, signup, logout, hasRole }),
    [user, ready, login, loginWithGoogle, signup, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};
