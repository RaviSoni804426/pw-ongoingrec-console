'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { authProviders } from '@/lib/schemas';
import { GoogleSignIn } from '@/components/google-sign-in';

export default function LoginPage() {
  const { login, signup, user, ready } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signupOffered, setSignupOffered] = useState(false);

  // The server decides whether accounts can be created, so the form is not
  // offered against a flag baked into the bundle.
  useEffect(() => {
    apiFetch('/auth/providers', authProviders, { anonymous: true })
      .then((providers) => setSignupOffered(providers.openSignup))
      .catch(() => {
        // Not fatal — sign-in still works, and an error here would be
        // confusing on a page nobody has touched yet.
      });
  }, []);

  useEffect(() => {
    if (ready && user) router.replace('/');
  }, [ready, user, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
      router.replace('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <div className="mb-6 flex items-center gap-3">
            {/* Two files, swapped by CSS rather than by reading the theme in JS:
                the mark is monochrome, so it needs to invert with the surface
                it sits on, and a flash of the wrong one on load looks broken. */}
            <Image
              src="/logo.png"
              alt=""
              width={40}
              height={40}
              className="dark:hidden"
              priority
            />
            <Image
              src="/logo-dark.png"
              alt=""
              width={40}
              height={40}
              className="hidden dark:block"
              priority
            />
            <div>
              <h1 className="text-lg font-semibold">PW OngoingRec</h1>
              <p className="text-sm text-muted-foreground">
                {mode === 'signup' ? 'Create a console account' : 'Sign in to the admin console'}
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === 'signup' ? (
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium">
                  Your name
                </label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="signup-name"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? (
              <p role="alert" data-testid="login-error" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy} data-testid="auth-submit">
              {busy ? <Spinner className="text-primary-foreground" /> : null}
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>

            {signupOffered ? (
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signup' ? 'signin' : 'signup');
                  setError(null);
                }}
                className="w-full text-center text-xs text-muted-foreground hover:underline"
                data-testid="auth-toggle"
              >
                {mode === 'signup'
                  ? 'Already have an account? Sign in'
                  : 'No account yet? Create one'}
              </button>
            ) : null}
          </form>

          <div className="mt-6">
            <GoogleSignIn onError={setError} />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
