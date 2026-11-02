import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, CreditCard, Landmark, Smartphone, Wallet as WalletIcon } from 'lucide-react-native';
import { toast } from '@/shared/stores/toastStore';
import { Screen } from '@/shared/components/Screen';
import { AppHeader } from '@/shared/components/AppHeader';
import { colors } from '@/shared/theme';

const METHODS = [
  { id: 'wallet', label: 'Wallet balance', desc: 'Instant pay from your app wallet', icon: WalletIcon },
  { id: 'card', label: 'Credit / Debit card', desc: 'Visa, Mastercard, RuPay, Amex', icon: CreditCard },
  { id: 'upi', label: 'UPI', desc: 'GPay, PhonePe, Paytm & more', icon: Smartphone },
  { id: 'net_banking', label: 'Net banking', desc: 'All major banks', icon: Landmark },
] as const;

export default function PaymentsScreen() {
  return (
    <Screen header={<AppHeader variant="dark" title="Payment methods" />} bottomNav={false}>
      <View style={styles.content}>
        <Text style={styles.title}>Pay with</Text>
        <View style={styles.list}>
          {METHODS.map((m) => {
            const Icon = m.icon;
            return (
              <Pressable
                key={m.id}
                style={styles.row}
                onPress={() => toast(`${m.label} is coming soon`)}
              >
                <View style={styles.iconWrap}>
                  <Icon size={20} color={colors.brand[700]} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.label}>{m.label}</Text>
                  <Text style={styles.desc}>{m.desc}</Text>
                </View>
                <ChevronRight size={16} color={colors.neutral[300]} />
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.note}>
          All payments are processed securely. Refunds go straight to your wallet or original payment method.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
    marginBottom: 12,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    backgroundColor: '#fff',
    padding: 14,
  },
  rowOpen: {
    borderColor: colors.brand[200],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand[50],
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  desc: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  note: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 18,
    color: colors.neutral[400],
  },
});