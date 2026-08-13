'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace('/');
  }, [ready, user, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
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
              <p className="text-sm text-muted-foreground">Sign in to the admin console</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
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

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Spinner className="text-primary-foreground" /> : null}
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground">
            PW SSO replaces this sign-in in Cut B.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
