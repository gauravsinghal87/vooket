import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
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
} from 'lucide-react-native';
import { repositories } from '@/api/repositories';
import { useAuthStore } from '@/stores/authStore';
import { useAppStore } from '@/stores/appStore';
import { toast } from '@/stores/toastStore';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Loader } from '@/components/ui/primitives';
import { getBranding } from '@/lib/branding';
import { formatCurrency } from '@/lib/utils';
import { colors, withAlpha } from '@/theme';

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
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeadWrap}>
        <Text style={styles.sectionHead}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  to,
  onClick,
  tone,
}: {
  icon: typeof CircleUser;
  label: string;
  value?: React.ReactNode;
  to?: string;
  onClick?: () => void;
  tone?: 'default' | 'danger';
}) {
  const router = useRouter();
  const danger = tone === 'danger';
  const content = (
    <View style={styles.row}>
      <Icon size={20} color={danger ? colors.danger : colors.neutral[500]} />
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      {value}
      <ChevronRight size={16} color={colors.neutral[300]} />
    </View>
  );
  if (to) {
    return <Pressable onPress={() => router.push(to as never)}>{content}</Pressable>;
  }
  return <Pressable onPress={onClick}>{content}</Pressable>;
}

export default function ProfileScreen() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [couponsOpen, setCouponsOpen] = useState(false);

  // Veg Mode is a real persisted preference (same store the Food home reads).
  const vegMode = useAppStore((s) => s.vegMode);
  const setVegMode = useAppStore((s) => s.setVegMode);

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
    router.replace('/');
  };

  // Profile completion from the fields the account really holds.
  const completion = user
    ? Math.round(([user.name, user.email, user.phone].filter((f) => f && String(f).trim()).length / 3) * 100)
    : 0;

  const brand = getBranding().name;

  if (!isAuthenticated) {
    return (
      <Screen
        header={<AppHeader variant="dark" title="Profile" />}
        bottomNav={false}
        scrollProps={{ contentContainerStyle: { flexGrow: 1, justifyContent: 'center' } }}
      >
        <View style={styles.guest}>
          <Avatar name="Guest" size="lg" />
          <Text style={styles.guestTitle}>You&apos;re not signed in</Text>
          <Text style={styles.guestDesc}>Sign in to manage orders, wallet and addresses.</Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push({ pathname: '/auth/login', params: { redirect: '/profile' } } as never)}
          >
            <Text style={styles.primaryText}>Sign in</Text>
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={() => router.push('/auth/register' as never)}>
            <Text style={styles.outlineText}>Create account</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const moreMenu: MenuItem[] = [
    { icon: LifeBuoy, label: 'Help & support', onClick: () => toast('Support tickets coming soon') },
    { icon: Bell, label: 'Notifications', onClick: () => setNotifOpen(true) },
    { icon: Languages, label: 'Language', onClick: () => toast('Language settings coming soon') },
    { icon: ShieldCheck, label: 'Privacy', onClick: () => toast('Privacy settings coming soon') },
    { icon: Lock, label: 'Security', onClick: () => toast('Security settings coming soon') },
    { icon: FileText, label: 'Terms & policies', onClick: () => toast('Terms will open soon') },
  ];

  return (
    <Screen header={<AppHeader variant="dark" title="Profile" />} bottomNav={false} scroll={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account card: avatar, identity, view activity. */}
        <View style={styles.accountCard}>
          <Avatar name={user?.name ?? user?.email ?? 'User'} size="lg" />
          <View style={styles.accountInfo}>
            <Text style={styles.accountName} numberOfLines={1}>
              {user?.name ?? user?.email}
            </Text>
            <Pressable style={styles.activityLink} onPress={() => router.push('/orders' as never)}>
              <Text style={styles.activityText}>View activity</Text>
              <ChevronRight size={14} color={colors.food[600]} />
            </Pressable>
          </View>
        </View>

        {/* Membership banner — black and gold, as the reference's. */}
        <Pressable style={styles.goldBanner} onPress={() => toast(`${brand} Gold coming soon`)}>
          <View style={styles.goldCrown}>
            <Crown size={18} color={colors.ink[950]} />
          </View>
          <Text style={styles.goldLabel}>Join {brand} Gold</Text>
          <ChevronRight size={20} color={colors.zGold} />
        </Pressable>

        {/* Money + coupons mini-cards. */}
        <View style={styles.miniRow}>
          <Pressable style={styles.miniCard} onPress={() => router.push('/wallet' as never)}>
            <View style={styles.miniIcon}>
              <WalletIcon size={18} color={colors.neutral[500]} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.miniTitle} numberOfLines={1}>{brand} Money</Text>
              <Text style={styles.miniValue}>{wallet.data ? formatCurrency(Number(wallet.data.balance)) : '—'}</Text>
            </View>
          </Pressable>
          <Pressable style={styles.miniCard} onPress={() => setCouponsOpen(true)}>
            <View style={styles.miniIcon}>
              <Ticket size={18} color={colors.neutral[500]} />
            </View>
            <Text style={[styles.miniTitle, { flex: 1 }]} numberOfLines={1}>Your coupons</Text>
          </Pressable>
        </View>

        {/* Preference rows. */}
        <View style={styles.prefCard}>
          <Row
            icon={CircleUser}
            label="Your profile"
            to="/profile/edit"
            value={
              completion < 100 ? (
                <View style={styles.completionBadge}>
                  <Text style={styles.completionText}>{completion}% completed</Text>
                </View>
              ) : undefined
            }
          />
          <Row
            icon={Leaf}
            label="Veg Mode"
            onClick={() => setVegMode(!vegMode)}
            value={
              <Text style={styles.prefValue}>{vegMode ? 'On' : 'Off'}</Text>
            }
          />
          <Row icon={WalletIcon} label="Payment settings" to="/profile/payments" />
          <Row icon={MapPin} label="Saved addresses" to="/profile/addresses" />
        </View>

        <SectionCard title="Food Orders">
          <Row icon={CircleUser} label="Your orders" to="/orders" />
          <Row icon={WalletIcon} label="Wallet" to="/wallet" />
          <Row icon={Bell} label="Notifications" onClick={() => setNotifOpen(true)} />
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
          <Row icon={LogOut} label="Log out" tone="danger" onClick={() => setLogoutOpen(true)} />
        </SectionCard>

        <Pressable style={styles.deleteBtn} onPress={() => setDeleteOpen(true)}>
          <Trash2 size={16} color={colors.danger} />
          <Text style={styles.deleteText}>Delete account</Text>
        </Pressable>
      </ScrollView>

      <BottomSheet title="Sign out?" visible={logoutOpen} onClose={() => setLogoutOpen(false)}>
        <Text style={styles.sheetDesc}>You will need to sign in again to access your orders and wallet.</Text>
        <View style={styles.sheetActions}>
          <Pressable style={[styles.sheetBtn, styles.sheetCancel]} onPress={() => setLogoutOpen(false)}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.sheetBtn, styles.sheetDanger]} onPress={handleLogout} disabled={logoutPending}>
            <Text style={styles.sheetDangerText}>{logoutPending ? 'Signing out…' : 'Sign out'}</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet title="Delete account?" visible={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <Text style={styles.sheetDesc}>This will permanently delete your account and data. This action cannot be undone.</Text>
        <View style={styles.sheetActions}>
          <Pressable style={[styles.sheetBtn, styles.sheetCancel]} onPress={() => setDeleteOpen(false)}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.sheetBtn, styles.sheetDanger]} onPress={() => toast('Account deletion coming soon')}>
            <Text style={styles.sheetDangerText}>Delete</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet title="Notifications" visible={notifOpen} onClose={() => setNotifOpen(false)}>
        {notifications.isLoading && <Loader label="Loading…" />}
        {notifications.data && notifications.data.length === 0 && (
          <Text style={styles.noNotif}>No notifications yet.</Text>
        )}
        {notifications.data && notifications.data.length > 0 && (
          <View style={styles.notifList}>
            {notifications.data.map((n) => (
              <View key={n.id} style={styles.notifCard}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifBody}>{n.body}</Text>
              </View>
            ))}
          </View>
        )}
      </BottomSheet>

      <BottomSheet title="Your coupons" visible={couponsOpen} onClose={() => setCouponsOpen(false)}>
        {coupons.isLoading && <Loader label="Loading…" />}
        {coupons.data && coupons.data.length === 0 && (
          <Text style={styles.noNotif}>No coupons yet. Check back soon!</Text>
        )}
        {coupons.data && coupons.data.length > 0 && (
          <View style={styles.notifList}>
            {coupons.data.map((coupon) => (
              <View key={coupon.id} style={styles.couponCard}>
                <View style={styles.couponCode}>
                  <Text style={styles.couponCodeText}>{coupon.code}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.notifTitle}>{coupon.name}</Text>
                  <Text style={styles.notifBody}>
                    {coupon.description}
                    {parseFloat(coupon.min_order_amount) > 0 && ` · Min. order ${formatCurrency(Number(coupon.min_order_amount))}`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  guest: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink[900],
    marginTop: 6,
  },
  guestDesc: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    paddingHorizontal: 36,
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  outlineBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 36,
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  outlineText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink[800],
  },

  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    padding: 18,
  },
  accountInfo: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.ink[900],
  },
  activityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.food[600],
  },

  goldBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    backgroundColor: colors.ink[900],
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  goldCrown: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.zGold,
  },
  goldLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.zGold,
  },

  miniRow: {
    flexDirection: 'row',
    gap: 12,
  },
  miniCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    padding: 14,
  },
  miniIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[800],
  },
  miniValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '800',
    color: colors.success,
  },

  prefCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[100],
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[800],
  },
  prefValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  completionBadge: {
    borderRadius: 8,
    backgroundColor: colors.amber[600] ? withAlpha(colors.amber[600], 0.12) : colors.food[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  completionText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.amber[700],
  },

  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    overflow: 'hidden',
  },
  sectionHeadWrap: {
    borderLeftWidth: 4,
    borderLeftColor: colors.food[600],
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionHead: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  sectionBody: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },

  sheetDesc: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.neutral[500],
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  sheetBtn: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 13,
  },
  sheetCancel: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  sheetCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[800],
  },
  sheetDanger: {
    backgroundColor: colors.danger,
  },
  sheetDangerText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  noNotif: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14,
    color: colors.neutral[500],
  },
  notifList: {
    gap: 10,
  },
  notifCard: {
    backgroundColor: colors.ink[50],
    borderRadius: 16,
    padding: 12,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  notifBody: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 12,
  },
  couponCode: {
    borderRadius: 8,
    backgroundColor: colors.food[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  couponCodeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.food[600],
  },
});
