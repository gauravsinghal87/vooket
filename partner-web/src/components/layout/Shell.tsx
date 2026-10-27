import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { CarTaxiFront, Bike, LayoutDashboard, BellRing, Banknote, Settings, LogOut, ChevronDown, Menu, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { LocationSync } from '@/components/live/LocationSync';
import { cn } from '@/lib/utils';
import type { PartnerRole } from '@/typings/models';

export function Shell() {
  const { user, role, profile, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const flows: Record<PartnerRole, { label: string; brand: string; icon: typeof Bike }> = {
    driver: { label: 'Driver · Rides', brand: 'p-driver', icon: CarTaxiFront },
    delivery_partner: { label: 'Delivery Partner', brand: 'p-delivery', icon: Bike },
  };
  const flow = flows[role as PartnerRole] ?? flows.driver;
  const BrandIcon = flow.icon;

  const slugSet = new Set((user?.roles ?? []).map((r) => r.slug));
  const canSwitch = slugSet.has('driver') && slugSet.has('delivery_partner');

  const navSections = [
    {
      label: 'Working',
      items: [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/requests', label: 'Incoming jobs', icon: BellRing },
      ],
    },
    {
      label: 'Money',
      items: [{ to: '/earnings', label: 'Earnings & Wallet', icon: Banknote }],
    },
    {
      label: 'Account',
      items: [{ to: '/profile', label: 'Profile & KYC', icon: Settings }],
    },
  ];

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const handleSwitch = async () => {
    setMenuOpen(false);
    await useAuthStore.getState().switchRole();
    navigate('/');
  };

  const NavItems = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 space-y-6 overflow-y-auto py-5">
      {navSections.map((section) => (
        <div key={section.label}>
          <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{section.label}</p>
          <div className="space-y-1 px-3">
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-600/10 text-brand-700' : 'text-neutral-600 hover:bg-ink-50 hover:text-neutral-900'
                  )
                }
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const statusChip = (
    <span className={cn('hidden items-center gap-2 text-xs text-neutral-400 sm:flex')}>
      <span className={cn('h-2 w-2 rounded-full', profile?.is_online ? 'bg-emerald-500' : 'bg-neutral-300')} />
      {profile?.is_busy ? 'On a job' : profile?.is_online ? 'Online' : 'Offline'}
    </span>
  );

  return (
    <div className={cn('flex min-h-dvh bg-ink-50', flow.brand)}>
      <LocationSync />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-100 bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <BrandIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-neutral-900">{user?.name ?? 'Partner Hub'}</p>
            <p className="truncate text-xs text-neutral-400">{flow.label}</p>
          </div>
        </div>
        <NavItems />
        <div className="border-t border-ink-100 p-2">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-ink-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                {user?.name?.charAt(0) ?? 'P'}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold text-neutral-800">{profile ? `#${profile.id}` : '—'}</p>
                <p className="truncate text-xs text-neutral-400">{flow.label}</p>
              </div>
              <ChevronDown className={cn('h-4 w-4 text-neutral-400 transition-transform', menuOpen && 'rotate-180')} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-[40]" onClick={() => setMenuOpen(false)} />
                <div className="absolute bottom-full left-0 z-[41] mb-2 w-full rounded-xl border border-ink-100 bg-white p-1.5 shadow-card">
                  <div className="mb-1 rounded-lg bg-ink-50 px-3 py-2">
                    <p className="text-xs text-neutral-400">Current role</p>
                    <p className="text-sm font-semibold capitalize text-neutral-800">{flow.label}</p>
                  </div>
                  {canSwitch && (
                    <Button variant="outline" size="sm" className="mb-1 w-full justify-start" onClick={handleSwitch}>
                      Switch to {role === 'driver' ? 'delivery' : 'driver'} role
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="w-full justify-start text-red-600" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" /> Sign out
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <BrandIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-neutral-900">{user?.name ?? 'Partner Hub'}</p>
                  <p className="text-xs text-neutral-400">{flow.label}</p>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-neutral-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-ink-100 p-2">
              {canSwitch && (
                <Button variant="outline" size="sm" className="mb-1 w-full justify-start" onClick={handleSwitch}>
                  Switch role
                </Button>
              )}
              <Button variant="ghost" size="sm" className="w-full justify-start text-red-600" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-100 bg-white/80 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 text-neutral-600 hover:bg-ink-50 lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="flex items-center gap-2 text-sm font-bold text-neutral-900 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <BrandIcon className="h-4 w-4" />
            </span>
            {flow.label}
          </Link>
          <div className="ml-auto">{statusChip}</div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}