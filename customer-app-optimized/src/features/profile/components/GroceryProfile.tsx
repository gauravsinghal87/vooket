import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  CircleUser,
  CreditCard,
  FileText,
  LifeBuoy,
  LogOut,
  MapPin,
  ShoppingBasket,
  Ticket,
  Trash2,
  Wallet as WalletIcon,
} from 'lucide-react-native';
import { Avatar } from '@/shared/components/ui/Avatar';
import { toast } from '@/shared/stores/toastStore';
import { formatCurrency } from '@/shared/utils/utils';
import { colors, withAlpha } from '@/shared/theme';

/** Shared shape the profile screen hands every module variant. */
export interface ProfileVariantProps {
  brand: string;
  user: { name?: string | null; email?: string | null; phone?: string | null } | null;
  /** Profile completion percentage (0-100) from the account's real fields. */
  completion: number;
  walletBalance: number | null;
  onBack: () => void;
  onOpenNotifications: () => void;
  onOpenCoupons: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
}

/** One grouped-card row: icon, label, optional right-side value, chevron. */
function GRow({
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
  return (
    <Pressable
      onPress={() => (to ? router.push(to as never) : onClick?.())}
      style={styles.row}
    >
      <Icon size={20} color={danger ? colors.danger : colors.grocery[700]} />
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]} numberOfLines={1}>
        {label}
      </Text>
      {value}
      <ChevronRight size={16} color={colors.neutral[300]} />
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

/**
 * The Grocery module's profile screen — the Blinkit "Your account" layout: a
 * soft yellow gradient header with the centred identity, three quick-action
 * cards, then the "Your information / Payment and coupons / Other" groups.
 * Every row maps to a real destination or action in this app (no fake entries).
 */
export function GroceryProfile({
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
  const router = useRouter();
  const identity = user?.name ?? user?.email ?? 'User';

  return (
    <View style={styles.root}>
      {/* Blinkit's soft yellow header; the module palette is already that gold. */}
      <LinearGradient
        colors={[colors.grocery[200], colors.grocery[100], colors.grocery[50]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.ink[900]} />
        </Pressable>

        <View style={styles.headerIdentity}>
          <View style={styles.avatarRing}>
            <Avatar name={identity} size="lg" />
          </View>
          <Text style={styles.headerTitle}>Your account</Text>
          <Text style={styles.headerSub}>{user?.phone ?? user?.email ?? ''}</Text>
          {completion < 100 && (
            <Pressable style={styles.completionPill} onPress={() => router.push('/profile/edit' as never)}>
              <Text style={styles.completionPillText}>Complete your profile · {completion}%</Text>
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {/* The three quick actions Blinkit leads with. */}
      <View style={styles.quickRow}>
        <Pressable style={styles.quickCard} onPress={() => router.push('/orders' as never)}>
          <ShoppingBasket size={26} color={colors.grocery[700]} />
          <Text style={styles.quickLabel}>Your orders</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={() => router.push('/wallet' as never)}>
          <WalletIcon size={26} color={colors.grocery[700]} />
          <Text style={styles.quickLabel}>{brand} Money</Text>
          <Text style={styles.quickValue}>{walletBalance !== null ? formatCurrency(walletBalance) : '—'}</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={() => toast('Support tickets coming soon')}>
          <LifeBuoy size={26} color={colors.grocery[700]} />
          <Text style={styles.quickLabel}>Need help?</Text>
        </Pressable>
      </View>

      <Group title="Your information">
        <GRow icon={MapPin} label="Address book" to="/grocery/profile/addresses" />
        <GRow
          icon={CircleUser}
          label="Your profile"
          to="/profile/edit"
          value={
            completion < 100 ? (
              <View style={styles.completionBadge}>
                <Text style={styles.completionBadgeText}>{completion}%</Text>
              </View>
            ) : undefined
          }
        />
      </Group>

      <Group title="Payment and coupons">
        <GRow
          icon={WalletIcon}
          label="Wallet"
          to="/wallet"
          value={
            <Text style={styles.moneyValue}>
              {walletBalance !== null ? formatCurrency(walletBalance) : '—'}
            </Text>
          }
        />
        <GRow icon={CreditCard} label="Payment settings" to="/profile/payments" />
        <GRow icon={Ticket} label="Your coupons" onClick={onOpenCoupons} />
      </Group>

      <Group title="Other">
        <GRow icon={Bell} label="Notifications" onClick={onOpenNotifications} />
        <GRow icon={LifeBuoy} label="Help & support" onClick={() => toast('Support tickets coming soon')} />
        <GRow icon={FileText} label="Terms & policies" onClick={() => toast('Terms will open soon')} />
        <GRow icon={LogOut} label="Log out" tone="danger" onClick={onLogout} />
      </Group>

      <Pressable style={styles.deleteBtn} onPress={onDeleteAccount}>
        <Trash2 size={16} color={colors.danger} />
        <Text style={styles.deleteText}>Delete account</Text>
      </Pressable>

      <Text style={styles.footer}>{brand}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 16,
    paddingBottom: 24,
  },
  header: {
    marginHorizontal: -16,
    marginTop: -12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  headerIdentity: {
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  avatarRing: {
    backgroundColor: '#fff',
    borderRadius: 999,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  headerTitle: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink[900],
  },
  headerSub: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  completionPill: {
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: colors.grocery[500],
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  completionPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink[800],
    textAlign: 'center',
  },
  quickValue: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.success,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[500],
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[100],
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[800],
  },
  completionBadge: {
    borderRadius: 999,
    backgroundColor: withAlpha('#ea580c', 0.12),
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  completionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
  },
  moneyValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.success,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: colors.neutral[400],
  },
});
