import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  CircleUser,
  Crown,
  FileText,
  Languages,
  Leaf,
  LifeBuoy,
  Lock,
  LogOut,
  MapPin,
  ShieldCheck,
  Ticket,
  Trash2,
  Wallet as WalletIcon,
  Loader2,
} from 'lucide-react';
import { repositories } from '@/repositories';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { activeService } from '@/components/service/service-theme';
import { GroceryProfile, type ProfileVariantProps } from '@/components/profile/grocery-profile';
import { RidesProfile } from '@/components/profile/rides-profile';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useBranding } from '@/hooks/useBranding';
import { formatCurrency } from '@/lib/utils';

interface MenuItem {
  icon: typeof CircleUser;
  label: string;
  to?: string;
  onClick?: () => void;
  tone?: 'default' | 'danger';
}

/** Section card with a red left rule — the reference's grouping treatment. */
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden p-0">
      <h2 className="border-l-4 border-food-600 px-4 py-3 text-[15px] font-bold text-neutral-900">{title}</h2>
      <div className="divide-y divide-neutral-100 border-t border-neutral-100">{children}</div>
    </Card>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  trailing,
  to,
  onClick,
  tone,
}: {
  icon: typeof CircleUser;
  label: string;
  value?: React.ReactNode;
  trailing?: React.ReactNode;
  to?: string;
  onClick?: () => void;
  tone?: 'default' | 'danger';
}) {
  const content = (
    <span className="flex w-full items-center gap-3 px-4 py-3.5">
      <Icon className={tone === 'danger' ? 'h-5 w-5 shrink-0 text-danger' : 'h-5 w-5 shrink-0 text-neutral-500'} />
      <span className={tone === 'danger' ? 'flex-1 text-left text-sm font-semibold text-danger' : 'flex-1 text-left text-sm font-semibold text-neutral-800'}>
        {label}
      </span>
      {value}
      {trailing ?? (to ? <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" /> : null)}
    </span>
  );
  if (to) {
    return (
      <Link to={to} className="block transition-colors hover:bg-neutral-50">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full text-left transition-colors hover:bg-neutral-50">
      {content}
    </button>
  );
}

/**
 * Zomato's profile screen — the Food module's variant: the account card with
 * "View activity", the black membership banner, the money/coupons mini-cards,
 * the preference rows and the red-ruled section cards down to Log out. Every
 * row maps to a real destination or action in this app.
 */
function FoodProfile({
  brand,
  user,
  completion,
  walletBalance,
  onBack,
  onOpenNotifications,
  onOpenCoupons,
  onLogout,
  onDeleteAccount,
}: ProfileVariantProps) {
  // Veg Mode is a real persisted preference (same store the Food home reads).
  const vegMode = useAppStore((s) => s.vegMode);
  const setVegMode = useAppStore((s) => s.setVegMode);

  const moreMenu: MenuItem[] = [
    { icon: LifeBuoy, label: 'Help & support', to: '/support' },
    { icon: Bell, label: 'Notifications', onClick: onOpenNotifications },
    { icon: Languages, label: 'Language', onClick: () => toast('Language settings coming soon') },
    { icon: ShieldCheck, label: 'Privacy', onClick: () => toast('Privacy settings coming soon') },
    { icon: Lock, label: 'Security', onClick: () => toast('Security settings coming soon') },
    { icon: FileText, label: 'Terms & policies', onClick: () => toast('Terms will open soon') },
  ];

  return (
    <div className="space-y-4">
      {/* Back arrow — the reference leads the screen with it. */}
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className="tap -ml-1 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-200/70"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      {/* Account card: avatar, identity, view activity. */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar name={user?.name ?? user?.email ?? 'User'} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-neutral-900">
              {user?.name ?? user?.email}
            </h1>
            <Link
              to="/orders"
              className="mt-1 inline-flex items-center gap-0.5 text-sm font-semibold text-food-600 hover:underline"
            >
              View activity <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </Card>

      {/* Membership banner — black and gold, as the reference's. */}
      <button
        type="button"
        onClick={() => toast(`${brand} Gold coming soon`)}
        className="tap flex w-full items-center gap-3 rounded-2xl bg-ink-900 px-4 py-4 text-left transition-colors hover:bg-ink-800"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-600 text-ink-950">
          <Crown className="h-5 w-5" />
        </span>
        <span className="flex-1 text-[15px] font-bold text-amber-300">Join {brand} Gold</span>
        <ChevronRight className="h-5 w-5 shrink-0 text-amber-300" />
      </button>

      {/* Money + coupons mini-cards. */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/wallet" className="rounded-2xl border border-neutral-100 bg-white p-3.5 transition-colors hover:border-neutral-200">
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              <WalletIcon className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold text-neutral-800">{brand} Money</span>
              <span className="block text-[13px] font-bold text-success">
                {walletBalance !== null ? formatCurrency(walletBalance) : '—'}
              </span>
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onOpenCoupons}
          className="rounded-2xl border border-neutral-100 bg-white p-3.5 text-left transition-colors hover:border-neutral-200"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              <Ticket className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 truncate text-[13px] font-bold text-neutral-800">Your coupons</span>
          </span>
        </button>
      </div>

      {/* Preference rows. */}
      <Card className="divide-y divide-neutral-100 p-0">
        <Row
          icon={CircleUser}
          label="Your profile"
          to="/profile/edit"
          value={
            completion < 100 ? (
              <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[12px] font-bold text-orange-600">
                {completion}% completed
              </span>
            ) : undefined
          }
        />
        <Row
          icon={Leaf}
          label="Veg Mode"
          onClick={() => setVegMode(!vegMode)}
          value={
            <>
              <span className="text-sm font-semibold text-neutral-500">{vegMode ? 'On' : 'Off'}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
            </>
          }
        />
        <Row icon={WalletIcon} label="Payment settings" to="/profile/payments" />
        <Row icon={MapPin} label="Saved addresses" to="/profile/addresses" />
      </Card>

      <SectionCard title="Food Orders">
        <Row icon={CircleUser} label="Your orders" to="/orders" />
        <Row icon={WalletIcon} label="Wallet" to="/wallet" />
        <Row icon={Bell} label="Notifications" onClick={onOpenNotifications} />
      </SectionCard>

      <SectionCard title="More">
        {moreMenu.slice(0, 3).map((item) => (
          <Row key={item.label} icon={item.icon} label={item.label} to={item.to} onClick={item.onClick} tone={item.tone} />
        ))}
      </SectionCard>

      <SectionCard title="Account">
        {moreMenu.slice(3).map((item) => (
          <Row key={item.label} icon={item.icon} label={item.label} to={item.to} onClick={item.onClick} tone={item.tone} />
        ))}
        <Row icon={LogOut} label="Log out" tone="danger" onClick={onLogout} />
      </SectionCard>

      <button
        onClick={onDeleteAccount}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold text-danger hover:bg-danger/10"
      >
        <Trash2 className="h-4 w-4" /> Delete account
      </button>
    </div>
  );
}

/**
 * The account screen is cross-module, so it renders the profile layout of the
 * module the switcher has selected: Food keeps the Zomato screen above, Grocery
 * gets Blinkit's "Your account" screen and Rides gets Rapido's flat menu.
 */
export function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [couponsOpen, setCouponsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Same resolution the module switcher uses on the other cross-module
  // screens: the route when it names a service (never `/profile`), otherwise
  // the persisted module the customer last picked.
  const storedService = useAppStore((s) => s.service);
  const module = activeService(pathname) ?? storedService;

  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => repositories.user.getNotifications(),
    enabled: notifOpen && isAuthenticated,
  });

  const coupons = useQuery({
    queryKey: ['profile-coupons'],
    queryFn: () => repositories.user.getCoupons(),
    enabled: couponsOpen && isAuthenticated,
  });

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => repositories.wallet.getWallet(),
    enabled: isAuthenticated,
  });

  const handleLogout = async () => {
    setLogoutPending(true);
    await logout();
    setLogoutPending(false);
    setLogoutOpen(false);
    toast('Signed out');
    navigate('/');
  };

  // Profile completion from the fields the account really holds.
  const completion = user
    ? Math.round(
        ([user.name, user.email, user.phone].filter((f) => f && String(f).trim()).length / 3) * 100
      )
    : 0;

  // Subscribes to the shared /app-config query, so the platform name is filled
  // in even when branding resolves after the first paint.
  const brand = useBranding().name;

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <Avatar name="Guest" size="lg" />
        <h1 className="text-xl font-extrabold text-neutral-900">You're not signed in</h1>
        <p className="text-sm text-neutral-500">Sign in to manage orders, wallet and addresses.</p>
        <div className="flex gap-2">
          <Link to="/auth/login">
            <Button>Sign in</Button>
          </Link>
          <Link to="/auth/register">
            <Button variant="outline">Create account</Button>
          </Link>
        </div>
      </div>
    );
  }

  const variant: ProfileVariantProps = {
    brand,
    user,
    completion,
    walletBalance: wallet.data ? Number(wallet.data.balance) : null,
    onBack: () => navigate(-1),
    onOpenNotifications: () => setNotifOpen(true),
    onOpenCoupons: () => setCouponsOpen(true),
    onLogout: () => setLogoutOpen(true),
    onDeleteAccount: () => setDeleteOpen(true),
  };

  return (
    <div className="mx-auto max-w-md">
      {module === 'grocery' ? (
        <GroceryProfile {...variant} />
      ) : module === 'rides' ? (
        <RidesProfile {...variant} />
      ) : (
        <FoodProfile {...variant} />
      )}

      <Modal title="Sign out?" open={logoutOpen} onOpenChange={setLogoutOpen}>
        <p className="text-sm text-neutral-600">You will need to sign in again to access your orders and wallet.</p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setLogoutOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleLogout}>
            {logoutPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign out'}
          </Button>
        </div>
      </Modal>

      <Modal title="Delete account?" open={deleteOpen} onOpenChange={setDeleteOpen}>
        <p className="text-sm text-neutral-600">
          This will permanently delete your account and data. This action cannot be undone.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1">
            Delete
          </Button>
        </div>
      </Modal>

      <BottomSheet title="Notifications" open={notifOpen} onOpenChange={setNotifOpen}>
        {notifications.isLoading && <Skeleton className="h-16 w-full rounded-2xl" />}
        {notifications.data && notifications.data.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500">No notifications yet.</p>
        )}
        {notifications.data && (
          <div className="space-y-2">
            {notifications.data.map((n) => (
              <Card key={n.id} className="p-3">
                <p className="text-sm font-semibold text-neutral-900">{n.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{n.body}</p>
              </Card>
            ))}
          </div>
        )}
      </BottomSheet>

      <BottomSheet title="Your coupons" open={couponsOpen} onOpenChange={setCouponsOpen}>
        {coupons.isLoading && <Skeleton className="h-16 w-full rounded-2xl" />}
        {coupons.data && coupons.data.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500">No coupons yet. Check back soon!</p>
        )}
        {coupons.data && coupons.data.length > 0 && (
          <div className="space-y-2">
            {coupons.data.map((coupon) => (
              <div key={coupon.id} className="flex items-start gap-3 rounded-2xl border border-neutral-200 p-3">
                <span className="rounded-lg bg-food-50 px-2 py-1 text-[11px] font-extrabold tracking-wide text-food-600">
                  {coupon.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-neutral-900">{coupon.name}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-neutral-500">
                    {coupon.description}
                    {parseFloat(coupon.min_order_amount) > 0 &&
                      ` · Min. order ${formatCurrency(Number(coupon.min_order_amount))}`}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
