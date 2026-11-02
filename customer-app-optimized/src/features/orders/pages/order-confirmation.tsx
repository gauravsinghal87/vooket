import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, MapPin, Timer, Wallet as WalletIcon } from 'lucide-react-native';
import { repositories } from '@/shared/repositories';
import { useAppStore } from '@/shared/stores/appStore';
import { colors, serviceTheme } from '@/shared/theme';
import { formatCurrency } from '@/shared/utils/utils';
import { EmptyState, Loader, PrimaryButton } from '@/shared/components/ui/primitives';
import { ProductImage } from '@/shared/components/ui/ProductImage';
import { Screen } from '@/shared/components/Screen';
import { AppHeader } from '@/shared/components/AppHeader';

export default function OrderConfirmationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const router = useRouter();
  const setService = useAppStore((s) => s.setService);

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => repositories.orders.getOrder(orderId),
    enabled: Number.isFinite(orderId),
  });

  const service = order?.order_type === 'grocery' ? 'grocery' : 'food';
  const theme = serviceTheme(service);

  useEffect(() => {
    if (order) setService(service);
  }, [order, service, setService]);

  if (isLoading) return <Screen header={<AppHeader variant="dark" title="Order" />}><Loader label="Loading order…" /></Screen>;

  if (isError || !order) {
    return (
      <Screen header={<AppHeader variant="dark" title="Order" />}>
        <View style={styles.flexCenter}>
          <EmptyState title="Order not found" actionLabel="Go to orders" onAction={() => router.replace('/orders' as never)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen header={<AppHeader variant="dark" title="Order confirmed" />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={{
            ...styles.hero,
            backgroundColor: theme.strong,
          }}
        >
          <View style={styles.heroIcon}>
            <CheckCircle2 size={36} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Order confirmed!</Text>
          <Text style={styles.heroSub}>We&apos;ve received your order.</Text>
          <Text style={styles.heroNumber}>{order.order_number}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardRowBetween}>
            <Text style={styles.cardTitle}>{order.order_type === 'grocery' ? 'Grocery order' : 'Food order'}</Text>
            <View style={[styles.badge, { backgroundColor: colors.warning }]}>
              <Text style={styles.badgeText}>{order.status.replace(/_/g, ' ')}</Text>
            </View>
          </View>
          <View style={styles.itemsList}>
            {(order.items ?? []).map((i) => (
              <View key={i.id} style={styles.itemRow}>
                <ProductImage src={i.product_image} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{i.product_name}</Text>
                  {i.selected_options && i.selected_options.length > 0 && (
                    <Text style={styles.itemOptions} numberOfLines={2}>
                      {(i.selected_options ?? []).map((o) => o.option_name).join(', ')}
                    </Text>
                  )}
                  <Text style={styles.itemQty}>{i.quantity} × {formatCurrency(Number(i.unit_price))}</Text>
                </View>
                <Text style={styles.itemTotal}>{formatCurrency(Number(i.line_total))}</Text>
              </View>
            ))}
          </View>
          <View style={styles.totalBlock}>
            <View style={styles.cardRowBetween}>
              <Text style={styles.cardTitle}>Total paid</Text>
              <Text style={styles.totalAmount}>{formatCurrency(Number(order.total_amount))}</Text>
            </View>
            <Text style={styles.totalMethod}>via {order.payment_method?.replace(/_/g, ' ')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <InfoRow icon={MapPin} color={theme.strong} title="Delivery address" value={order.delivery_address_snapshot ? `${order.delivery_address_snapshot.address_line_1}, ${order.delivery_address_snapshot.city}` : 'Address on file'} />
          <InfoRow icon={WalletIcon} color={theme.strong} title="Payment" value={order.payment_method?.replace(/_/g, ' ') ?? 'Online'} />
          <InfoRow
            icon={Timer}
            color={theme.strong}
            title="Estimated delivery"
            value={order.timing_type === 'scheduled' && order.scheduled_at ? new Date(order.scheduled_at).toLocaleString('en-IN') : '30–40 minutes'}
          />
        </View>

        <View style={styles.actions}>
          <Pressable style={{ flex: 1 }} onPress={() => router.replace(`/order/${order.id}` as never)}>
            <PrimaryButton label="Track Order" />
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={() => router.replace('/orders' as never)}>
            <Text style={styles.outlineBtnText}>View Orders</Text>
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={() => router.replace('/' as never)}>
            <Text style={styles.outlineBtnText}>Continue Shopping</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function InfoRow({ icon: Icon, color, title, value }: { icon: typeof MapPin; color: string; title: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Icon size={16} color={color} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  flexCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hero: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginTop: 14,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  heroNumber: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#fff',
    marginTop: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  cardRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#fff',
  },
  itemsList: {
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[900],
  },
  itemOptions: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 2,
  },
  itemQty: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[800],
  },
  totalBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    paddingTop: 12,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink[900],
  },
  totalMethod: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  infoValue: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 2,
  },
  actions: {
    gap: 10,
  },
  outlineBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink[900],
  },
});