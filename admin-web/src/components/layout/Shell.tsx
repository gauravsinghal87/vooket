import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ReceiptText,
  Route,
  UtensilsCrossed,
  ShoppingBag,
  Package,
  FolderTree,
  Users,
  CarTaxiFront,
  Bike,
  Store,
  ToggleLeft,
  Ticket,
  Megaphone,
  ShieldCheck,
  Settings,
  CircleDollarSign,
  PlugZap,
  RadioTower,
  MapPinned,
  Truck,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { OrderSoundWatcher } from '@/components/live/OrderSoundWatcher';
import { cn } from '@/lib/utils';

const navSections = [
  {
    label: 'Operations',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/orders', label: 'Orders', icon: ReceiptText },
      { to: '/support-tickets', label: 'Support', icon: ReceiptText },
      { to: '/dispatch-logs', label: 'Dispatch logs', icon: Route },
      { to: '/restaurants', label: 'Restaurants', icon: UtensilsCrossed },
      { to: '/stores', label: 'Grocery stores', icon: ShoppingBag },
      { to: '/products', label: 'Products', icon: Package },
      { to: '/categories', label: 'Categories', icon: FolderTree },
      { to: '/zones', label: 'Service zones', icon: MapPinned },
      { to: '/zone-delivery-configurations', label: 'Zone delivery configuration', icon: Truck },
    ],
  },
  {
    label: 'Ride',
    items: [
      { to: '/fare-rules', label: 'Fare rules', icon: CircleDollarSign },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/users', label: 'Customers', icon: Users },
      { to: '/riders', label: 'Riders', icon: CarTaxiFront },
      { to: '/delivery-partners', label: 'Delivery partners', icon: Bike },
      { to: '/vendors', label: 'Vendors', icon: Store },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/payouts', label: 'Payouts', icon: CircleDollarSign },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/coupons', label: 'Coupons', icon: Ticket },
      { to: '/banners', label: 'Banners', icon: Megaphone },
      { to: '/feature-flags', label: 'Feature flags', icon: ToggleLeft },
    ],
  },
  {
    label: 'Access',
    items: [
      { to: '/roles', label: 'Roles & permissions', icon: ShieldCheck },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/integrations', label: 'Integrations', icon: PlugZap },
      { to: '/webhooks', label: 'Webhooks', icon: RadioTower },
    ],
  },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
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
}

function UserMenu() {
  const { profile, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          {profile?.name?.charAt(0) ?? 'A'}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold text-neutral-800">{profile?.name ?? 'Admin'}</p>
          <p className="truncate text-xs text-neutral-400">{profile?.email ?? 'admin@superapp.com'}</p>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-neutral-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[40]" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-[41] mb-2 w-full rounded-xl border border-ink-100 bg-white p-1.5 shadow-card">
            <Button variant="ghost" size="sm" className="w-full justify-start text-red-600" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function Shell() {
  const { profile } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-ink-50">
      {/* Plays /sounds/notification.mp3 when a new order arrives on the admin stream. */}
      <OrderSoundWatcher identity={profile?.id ? `a:${profile.id}` : ''} />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-100 bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-900">Super Admin</p>
            <p className="text-xs text-neutral-400">Control panel</p>
          </div>
        </div>
        <NavItems />
        <div className="border-t border-ink-100 p-2">
          <UserMenu />
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
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-neutral-900">Super Admin</p>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-neutral-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-ink-100 p-2">
              <UserMenu />
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-100 bg-white/80 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-lg p-2 text-neutral-600 hover:bg-ink-50 lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="flex items-center gap-2 text-sm font-bold text-neutral-900 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <ShieldCheck className="h-4 w-4" />
            </span>
            Super Admin
          </Link>
          <div className="ml-auto hidden items-center gap-2 text-xs text-neutral-400 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Connected
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}