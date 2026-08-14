'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { authProviders } from '@/lib/schemas';

/**
 * The Google sign-in button.
 *
 * Google's script renders the button itself and hands back an ID token, which
 * goes straight to our API. Everything that decides *who may sign in* — the
 * domain rule, whether an account exists, whether it has a console role —
 * happens there, on a token whose signature has been verified.
 *
 * None of that could be done here. Anything this file checked could be removed
 * with the browser's developer console.
 */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SCRIPT_ID = 'google-identity-services';

export const GoogleSignIn = ({ onError }: { onError: (message: string) => void }) => {
  const { loginWithGoogle } = useAuth();
  const container = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  // The server decides whether Google sign-in is available at all, so the
  // button is not rendered against a client id baked into the bundle.
  useEffect(() => {
    let cancelled = false;

    apiFetch('/auth/providers', authProviders, { anonymous: true })
      .then((providers) => {
        if (!cancelled && providers.google && providers.googleClientId) {
          setClientId(providers.googleClientId);
        }
      })
      .catch(() => {
        // Not fatal: password sign-in still works, and an error here would be
        // confusing on a page the user has not interacted with yet.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId || !container.current) return;

    const render = () => {
      if (!window.google || !container.current) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          void loginWithGoogle(response.credential).catch((error: unknown) => {
            // The server's message is the useful one — it says whether the
            // domain was wrong or the account simply does not exist.
            onError(error instanceof Error ? error.message : 'Google sign-in failed');
          });
        },
        auto_select: false,
      });

      window.google.accounts.id.renderButton(container.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        width: 320,
      });
    };

    if (document.getElementById(SCRIPT_ID)) {
      render();
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => onError('Could not load Google sign-in');
    document.head.appendChild(script);
  }, [clientId, loginWithGoogle, onError]);

  // Nothing at all when the server has no Google client configured, rather
  // than a button that cannot work.
  if (!clientId) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div ref={container} className="flex justify-center" data-testid="google-sign-in" />

      <p className="text-center text-xs text-muted-foreground">
        Use your @pw.live account.
      </p>
    </div>
  );
};
