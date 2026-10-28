import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Info, Loader2, Plus, Wallet as WalletIcon } from 'lucide-react-native';
import { repositories } from '@/api/repositories';
import type { WalletTransaction } from '@/types/catalog';
import { toast } from '@/stores/toastStore';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Loader } from '@/components/ui/primitives';
import { colors, shadows } from '@/theme';

const TOPUPS = [100, 500, 1000];

/** Brand gradient — `brand-600 → brand-700`, the same one customer-web's wallet hero paints. */
const BALANCE_GRADIENT = [colors.brand[600], colors.brand[700]] as const;

function formatPrice(value: number | string) {
  const n = Number(value ?? 0);
  return `\u20B9${n.toLocaleString('en-IN')}`;
}

export default function WalletScreen() {
  const queryClient = useQueryClient();
  const [topupOpen, setTopupOpen] = useState(false);
  const [amount, setAmount] = useState(500);
  const [txDetail, setTxDetail] = useState<WalletTransaction | null>(null);

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => repositories.wallet.getWallet() });
  const transactions = useQuery({ queryKey: ['wallet-transactions'], queryFn: () => repositories.wallet.getTransactions() });

  const topup = useMutation({
    mutationFn: (amt: number) => repositories.wallet.topup(amt),
    onSuccess: () => {
      toast(`${formatPrice(amount)} added to wallet`);
      setTopupOpen(false);
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
    },
    onError: () => toast('Could not add money', 'error'),
  });

  const txList = transactions.data ?? [];

  return (
    <Screen header={<AppHeader variant="dark" title="Wallet" />} contentStyle={styles.content}>
      {/* One stack carries the vertical rhythm, so the gutters and gaps stay
          consistent however many sections are on screen. */}
      <View style={styles.stack}>
        {wallet.isLoading && <Loader label="Loading wallet…" />}

        {wallet.isError && (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Couldn't load wallet</Text>
            <Pressable style={styles.retryBtn} onPress={() => wallet.refetch()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {wallet.data && (
          <LinearGradient
            colors={BALANCE_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <View style={styles.balanceHead}>
              <View style={styles.balanceBadge}>
                <WalletIcon size={20} color="#fff" />
              </View>
              <View style={styles.balanceHeadText}>
                <Text style={styles.balanceLabel}>Available balance</Text>
                <Text style={styles.balance}>{formatPrice(wallet.data.balance)}</Text>
              </View>
            </View>

            <View style={styles.balanceActions}>
              <Pressable style={styles.addBtn} onPress={() => setTopupOpen(true)}>
                <Plus size={16} color={colors.brand[700]} />
                <Text style={styles.addText}>Add money</Text>
              </Pressable>
            </View>

            <Text style={styles.pending}>
              Pending balance: {formatPrice(wallet.data.pending_balance)}
            </Text>
          </LinearGradient>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transactions</Text>

          {transactions.isLoading && <Loader label="Loading transactions…" />}

          {transactions.isError && (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Couldn't load transactions</Text>
            </View>
          )}

          {transactions.isSuccess && txList.length === 0 && (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <WalletIcon size={24} color={colors.brand[600]} />
              </View>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptyDesc}>Top up your wallet to get started.</Text>
              <Pressable style={styles.outlineBtn} onPress={() => setTopupOpen(true)}>
                <Plus size={15} color={colors.ink[800]} />
                <Text style={styles.outlineText}>Add money</Text>
              </Pressable>
            </View>
          )}

          {txList.length > 0 && (
            <View style={styles.txList}>
              {txList.map((t) => {
                const credit = t.direction === 'credit';
                return (
                  <Pressable key={t.id} style={styles.txRow} onPress={() => setTxDetail(t)}>
                    <View style={[styles.txIcon, credit ? styles.txCredit : styles.txDebit]}>
                      {credit ? (
                        <ArrowDownLeft size={18} color={colors.emerald[700]} />
                      ) : (
                        <ArrowUpRight size={18} color={colors.danger} />
                      )}
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txTitle} numberOfLines={1}>
                        {t.description ?? t.type.replace(/_/g, ' ')}
                      </Text>
                      <Text style={styles.txMeta}>
                        {t.type.replace(/_/g, ' ')} ·{' '}
                        {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, credit && styles.txAmountCredit]}>
                      {credit ? '+' : '-'}
                      {formatPrice(t.amount)}
                    </Text>
                    <ChevronRight size={16} color={colors.neutral[300]} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Info size={15} color={colors.brand[700]} />
          </View>
          <Text style={styles.infoText}>
            Refunds and cashbacks for cancelled orders are automatically credited to this wallet.
          </Text>
        </View>
      </View>

      <BottomSheet title="Add money" visible={topupOpen} onClose={() => setTopupOpen(false)}>
        <View style={styles.topupGrid}>
          {TOPUPS.map((t) => (
            <Pressable
              key={t}
              style={[styles.topupOption, amount === t && styles.topupOptionActive]}
              onPress={() => setAmount(t)}
            >
              <Text style={[styles.topupOptionText, amount === t && styles.topupOptionTextActive]}>{formatPrice(t)}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.confirmBtn, (amount <= 0 || topup.isPending) && { opacity: 0.6 }]}
          onPress={() => topup.mutate(amount)}
          disabled={amount <= 0 || topup.isPending}
        >
          {topup.isPending && <Loader2 size={16} color="#fff" />}
          <Text style={styles.confirmText}>
            Add {formatPrice(amount)} to wallet
          </Text>
        </Pressable>
        <Text style={styles.topupNote}>Payment gateway integration coming soon.</Text>
      </BottomSheet>

      <BottomSheet title="Transaction details" visible={txDetail !== null} onClose={() => setTxDetail(null)}>
        {txDetail && (
          <View style={styles.txDetail}>
            <View style={styles.txDetailHead}>
              <View style={[styles.txDetailIcon, txDetail.direction === 'credit' ? styles.txCredit : styles.txDebit]}>
                {txDetail.direction === 'credit' ? (
                  <ArrowDownLeft size={24} color={colors.emerald[700]} />
                ) : (
                  <ArrowUpRight size={24} color={colors.danger} />
                )}
              </View>
              <View style={styles.txDetailTitleWrap}>
                <Text style={styles.txDetailAmount}>
                  {txDetail.direction === 'credit' ? '+' : ''}
                  {formatPrice(txDetail.amount)}
                </Text>
                <Text style={styles.txDetailId} numberOfLines={1}>{txDetail.transaction_id}</Text>
              </View>
            </View>
            <DetailRow label="Type" value={txDetail.type.replace(/_/g, ' ')} />
            <DetailRow label="Date" value={new Date(txDetail.created_at).toLocaleString('en-IN')} />
            <DetailRow label="Status" value={txDetail.status} />
            <DetailRow label="Balance after" value={formatPrice(txDetail.balance_after)} />
          </View>
        )}
      </BottomSheet>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  stack: {
    gap: 16,
  },
  /* ---------------------------------------------------------------- states */
  stateCard: {
    alignItems: 'center',
    gap: 12,
    padding: 28,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  stateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink[800],
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[800],
  },
  /* --------------------------------------------------------------- balance */
  balanceCard: {
    borderRadius: 24,
    padding: 20,
    ...shadows.card,
  },
  balanceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  balanceBadge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  balanceHeadText: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  balance: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },
  balanceActions: {
    marginTop: 18,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignSelf: 'stretch',
  },
  addText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.brand[700],
  },
  pending: {
    marginTop: 12,
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
  },
  /* ---------------------------------------------------------- transactions */
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink[900],
    letterSpacing: -0.2,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand[50],
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  outlineText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[800],
  },
  txList: {
    gap: 10,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    backgroundColor: '#fff',
    padding: 12,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txCredit: {
    backgroundColor: 'rgba(5,150,105,0.12)',
  },
  txDebit: {
    backgroundColor: 'rgba(220,38,38,0.1)',
  },
  txInfo: {
    flex: 1,
    minWidth: 0,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  txMeta: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
    textTransform: 'lowercase',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
    textAlign: 'right',
  },
  txAmountCredit: {
    color: colors.emerald[700],
  },
  /* ------------------------------------------------------------------ info */
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 18,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[100],
    padding: 14,
  },
  infoIcon: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink[700],
    paddingRight: 4,
  },
  /* --------------------------------------------------------------- top-up */
  topupGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  topupOption: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingVertical: 14,
    alignItems: 'center',
  },
  topupOptionActive: {
    borderColor: colors.brand[600],
    backgroundColor: colors.brand[50],
  },
  topupOptionText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[700],
  },
  topupOptionTextActive: {
    color: colors.brand[700],
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    paddingVertical: 14,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  topupNote: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    color: colors.neutral[400],
  },
  /* ----------------------------------------------------------- tx detail */
  txDetail: {
    gap: 12,
  },
  txDetailHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  txDetailIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetailTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  txDetailAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink[900],
  },
  txDetailId: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[100],
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  detailValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[800],
    textTransform: 'capitalize',
    textAlign: 'right',
  },
});
