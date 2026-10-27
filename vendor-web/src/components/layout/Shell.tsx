import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ReceiptText,
  UtensilsCrossed,
  ShoppingBasket,
  Package,
  FolderTree,
  Ticket,
  Wallet,
  Store,
  CalendarClock,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  TriangleAlert,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { OrderSoundWatcher } from '@/components/live/OrderSoundWatcher';
import { cn } from '@/lib/utils';
import type { ImpersonationContext } from '@/repositories/vendor';
import type { VendorType } from '@/typings/models';

function navFor(vendorType: VendorType) {
  const isFood = vendorType === 'restaurant';
  return {
    brandClass: isFood ? 'vendor-food' : 'vendor-grocery',
    outletLabel: isFood ? 'Restaurants' : 'Stores',
    outletIcon: isFood ? UtensilsCrossed : ShoppingBasket,
    accentLabel: isFood ? 'Food' : 'Grocery',
    showDeliverySlots: !isFood,
  };
}

/**
 * Non-dismissable banner shown whenever an admin is driving this vendor
 * session. Deliberately loud and impossible to mistake for the vendor's own
 * login: the whole point is that the operator is never confused about whose
 * account they are acting in.
 *
 * Every value comes from the backend's impersonation context, which is
 * resolved from the bearer token, not from anything the browser asserts.
 */
function ImpersonationBanner({
  impersonation,
  onExit,
  exiting,
}: {
  impersonation: ImpersonationContext;
  onExit: () => void;
  exiting: boolean;
}) {
  const name = impersonation.vendor_business_name ?? 'this vendor';
  const admin = impersonation.impersonated_admin_name ?? impersonation.impersonated_admin_email;

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-white sm:px-6">
      <TriangleAlert className="h-4 w-4 shrink-0" />
      <p className="text-xs font-semibold sm:text-sm">
        Logged in as vendor: <span className="underline decoration-2 underline-offset-2">{name}</span>
        <span className="ml-1 font-normal opacity-95">(Admin access{admin ? ` · ${admin}` : ''})</span>
      </p>
      <Button
        size="sm"
        onClick={onExit}
        disabled={exiting}
        className="ml-auto shrink-0 border border-white/60 bg-white/15 text-white hover:bg-white/25"
      >
        <LogOut className="h-3.5 w-3.5" />
        {exiting ? 'Exiting…' : 'Exit Vendor Login'}
      </Button>
    </div>
  );
}

export function Shell() {
  const { profile, logout, impersonation, endImpersonation } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exiting, setExiting] = useState(false);

  const vendor = profile?.vendor;
  const flow = navFor((vendor?.vendor_type ?? 'restaurant') as VendorType);

  /**
   * Leave the impersonation session and hand the administrator back to the
   * admin panel. The backend revokes only the impersonation token, so the
   * admin's own session is still valid on return.
   */
  const handleExitImpersonation = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      const returnUrl = await endImpersonation();
      if (returnUrl) {
        // Full navigation: the admin panel is a separate origin with its own
        // already-valid session.
        window.location.assign(returnUrl);
        return;
      }
      navigate('/login', { replace: true });
    } finally {
      setExiting(false);
    }
  };
  const OutletIcon = flow.outletIcon;

  const navSections = [
    {
      label: 'Business',
      items: [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/orders', label: 'Orders', icon: ReceiptText },
        { to: '/earnings', label: 'Earnings', icon: Wallet },
      ],
    },
    {
      label: 'Catalogue',
      items: [
        { to: '/outlets', label: flow.outletLabel, icon: flow.outletIcon },
        { to: '/categories', label: 'Categories', icon: FolderTree },
        { to: '/products', label: 'Products', icon: Package },
        ...(flow.showDeliverySlots
          ? [{ to: '/delivery-slots', label: 'Delivery slots', icon: CalendarClock }]
          : []),
      ],
    },
    {
      label: 'Growth',
      items: [{ to: '/coupons', label: 'Coupons', icon: Ticket }],
    },
    {
      label: 'Account',
      items: [{ to: '/profile', label: 'Profile & settings', icon: Settings }],
    },
  ];

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const NavItems = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 space-y-6 overflow-y-auto py-5">
      {navSections.map((section) => (
        <div key={section.label}>
          <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            {section.label}
          </p>
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
                    isActive
                      ? 'bg-brand-600/10 text-brand-700'
                      : 'text-neutral-600 hover:bg-white/5 hover:text-neutral-900'
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

  return (
    <div className={cn('flex min-h-dvh flex-col bg-ink-50', flow.brandClass, impersonation && 'pt-12')}>
      {/* Plays /sounds/new_order.mp3 when a new order arrives for this vendor. */}
      <OrderSoundWatcher identity={profile?.id ? `v:${profile.id}` : ''} />
      {impersonation && (
        <ImpersonationBanner impersonation={impersonation} onExit={handleExitImpersonation} exiting={exiting} />
      )}
      <div className="flex min-w-0 flex-1">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-100 bg-white lg:flex',
          impersonation && 'lg:top-12',
        )}
      >
        <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-neutral-900">{vendor?.business_name ?? 'Vendor Hub'}</p>
            <p className="text-xs text-neutral-400">{flow.accentLabel} partner panel</p>
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
                {profile?.name?.charAt(0) ?? 'V'}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold text-neutral-800">{profile?.name ?? 'Vendor'}</p>
                <p className="truncate text-xs text-neutral-400">{profile?.email ?? ''}</p>
              </div>
              <ChevronDown className={cn('h-4 w-4 text-neutral-400 transition-transform', menuOpen && 'rotate-180')} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-[40]" onClick={() => setMenuOpen(false)} />
                <div className="absolute bottom-full left-0 z-[41] mb-2 w-full rounded-xl border border-ink-100 bg-white p-1.5 shadow-card">
                  <div className="mb-1 rounded-lg bg-ink-50 px-3 py-2">
                    <p className="text-xs text-neutral-400">Business type</p>
                    <p className="text-sm font-semibold capitalize text-neutral-800">{flow.accentLabel} vendor</p>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-red-600" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" /> Sign out
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <Store className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-neutral-900">{vendor?.business_name ?? 'Vendor Hub'}</p>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-neutral-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-ink-100 p-2">
              <Button variant="ghost" size="sm" className="w-full justify-start text-red-600" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-100 bg-white/80 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 text-neutral-600 hover:bg-ink-50 lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="flex items-center gap-2 text-sm font-bold text-neutral-900 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <OutletIcon className="h-4 w-4" />
            </span>
            Vendor Hub
          </Link>
          <div className="ml-auto hidden items-center gap-2 text-xs text-neutral-400 sm:flex">
            <span className={cn('h-2 w-2 rounded-full', vendor?.is_active ? 'bg-emerald-500' : 'bg-red-500')} />
            {vendor?.is_active ? 'Live' : 'Suspended'}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
      </div>
    </div>
  );
}