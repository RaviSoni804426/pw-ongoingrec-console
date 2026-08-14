'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  Building2,
  Search as SearchIcon,
  LogOut,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingBlock } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { Role } from '@/lib/schemas';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Omitted means every signed-in role sees it. */
  roles?: Role[];
}

/**
 * The whole flow is: centre → counsellor → recording. Everything else is a
 * supporting surface, so the navigation carries four items rather than seven.
 *
 * `/conversations` is deliberately absent: it is kept as a route for search but
 * demoted out of primary navigation (handoff §6.1), because a global list of
 * every recording is not a step anybody takes.
 */
const NAV: NavItem[] = [
  { href: '/', label: 'Centres', icon: Building2 },
  { href: '/search', label: 'Search', icon: SearchIcon },
  { href: '/enroll', label: 'Enrollment', icon: UserPlus },
  { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout, hasRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  if (!ready) return <LoadingBlock label="Loading console…" />;
  if (!user) return <LoadingBlock label="Redirecting to sign in…" />;

  const visible = NAV.filter((item) => !item.roles || hasRole(...item.roles));

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r bg-card md:flex md:flex-col">
        <div className="flex items-center gap-2.5 border-b px-4 py-4">
          <Image src="/logo.png" alt="" width={28} height={28} className="dark:hidden" />
          <Image src="/logo-dark.png" alt="" width={28} height={28} className="hidden dark:block" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">PW OngoingRec</p>
            <p className="text-xs text-muted-foreground">Admin console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 p-2" aria-label="Main">
          {visible.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  active ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.roles.join(', ')}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* min-w-0 stops a wide table from forcing the whole page to scroll. */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
