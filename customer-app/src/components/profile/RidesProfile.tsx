import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ArrowLeft,
  Award,
  Bell,
  Bike,
  ChevronRight,
  CircleUser,
  Coins,
  HelpCircle,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  Ticket,
  Trash2,
  Wallet as WalletIcon,
} from 'lucide-react-native';
import { Avatar } from '@/components/ui/Avatar';
import { toast } from '@/stores/toastStore';
import { formatCurrency } from '@/lib/utils';
import { colors } from '@/theme';
import type { ProfileVariantProps } from './GroceryProfile';

/** One flat list row in the Rapido menu style: icon, label, chevron. */
function RRow({
  icon: Icon,
  label,
  subtitle,
  value,
  iconColor,
  to,
  onClick,
  tone,
}: {
  icon: typeof CircleUser;
  label: string;
  subtitle?: string;
  value?: React.ReactNode;
  iconColor?: string;
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
      <Icon size={22} color={iconColor ?? (danger ? colors.danger : colors.neutral[500])} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]} numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {value}
      <ChevronRight size={16} color={colors.neutral[300]} />
    </Pressable>
  );
}

/**
 * The Rides module's profile screen — Rapido's flat menu list: the account row
 * on top, then the ride-centric rows down to Log out, and the cream
 * "Become a Captain" promo strip at the bottom. Every row maps to a real
 * destination or action in this app.
 */
export function RidesProfile({
  brand,
  user,
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
      <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
        <ArrowLeft size={22} color={colors.ink[900]} />
      </Pressable>

      {/* The flat white menu list. */}
      <View style={styles.list}>
        <Pressable style={styles.profileRow} onPress={() => router.push('/profile/edit' as never)}>
          <Avatar name={identity} size="sm" />
          <View style={styles.rowText}>
            <Text style={styles.profileName} numberOfLines={1}>
              {identity}
            </Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {user?.phone ?? user?.email ?? ''}
            </Text>
          </View>
          <ChevronRight size={16} color={colors.neutral[300]} />
        </Pressable>

        <RRow icon={HelpCircle} label="Help" to="/support" />
        <RRow icon={Package} label="Parcel - Send Items" onClick={() => toast('Parcel service coming soon')} />
        <RRow icon={WalletIcon} label="Payment" to="/profile/payments" />
        <RRow icon={CircleUser} label="My Rides" to="/orders" />
        <RRow icon={ShieldCheck} label="Safety" onClick={() => toast('Safety features coming soon')} />
        <RRow
          icon={Award}
          label="Refer and Earn"
          subtitle="Get ₹50"
          onClick={() => toast('Refer & earn coming soon')}
        />
        <RRow icon={Ticket} label="My Rewards" onClick={onOpenCoupons} />
        <RRow
          icon={Award}
          label={`${brand} Pass`}
          iconColor="#f59e0b"
          onClick={() => toast(`${brand} Pass coming soon`)}
        />
        <RRow
          icon={Coins}
          label={`${brand} Money`}
          value={
            <Text style={styles.moneyValue}>
              {walletBalance !== null ? formatCurrency(walletBalance) : '—'}
            </Text>
          }
          to="/wallet"
        />
        <RRow icon={Bell} label="Notifications" onClick={onOpenNotifications} />
        <RRow icon={Settings} label="Settings" to="/profile/edit" />
        <RRow icon={LogOut} label="Log out" tone="danger" onClick={onLogout} />
      </View>

      {/* Rapido's cream promo strip — become a delivery captain. */}
      <Pressable style={styles.promo} onPress={() => toast('Captain signup coming soon')}>
        <View style={styles.rowText}>
          <Text style={styles.promoTitle}>Earn money with {brand}</Text>
          <Text style={styles.promoSub}>Become a Captain!</Text>
        </View>
        <Bike size={38} color={colors.ink[700]} />
      </Pressable>

      <Pressable style={styles.deleteBtn} onPress={onDeleteAccount}>
        <Trash2 size={16} color={colors.danger} />
        <Text style={styles.deleteText}>Delete account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 14,
    paddingBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  list: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[100],
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
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink[900],
  },
  rowSub: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 1,
  },
  moneyValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.success,
  },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFDF5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  promoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  promoSub: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 1,
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
});
