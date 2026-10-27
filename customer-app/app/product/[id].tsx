import { useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Clock, Info, Minus, Plus, Tag } from 'lucide-react-native';
import type { OptionGroup, Product, ProductOption } from '@/types/catalog';
import {
  activeOptionGroups,
  defaultSelections,
  groupIsSingle,
  groupMaxSelect,
  groupMinSelect,
  needsOptionSelection,
  optionAvailable,
  optionPrice,
  unitPricePreview,
} from '@/lib/productOptions';
import { AddToCartControl } from '@/components/product/AddToCart';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { ProductImage } from '@/components/ui/ProductImage';
import { EmptyState } from '@/components/ui/primitives';
import { useCartAdd } from '@/hooks/useCart';
import { toast } from '@/stores/toastStore';
import { takeProduct, type CarriedProduct } from '@/lib/routeState';
import { discountPercent, formatCurrency } from '@/lib/utils';
import { colors, withAlpha } from '@/theme';

const COLLAPSE_THRESHOLD = 3;

function selectionRule(group: OptionGroup): string {
  const min = groupMinSelect(group);
  const max = groupMaxSelect(group);
  if (groupIsSingle(group)) return min > 0 ? 'Required · choose 1' : 'Select up to 1 option';
  if (min === max) return `Select ${min} option${min > 1 ? 's' : ''}`;
  if (min > 0) return `Select ${min}–${max} options`;
  return `Select up to ${max} options`;
}

export default function ProductScreen() {
  const params = useLocalSearchParams<{ id: string; service?: string }>();
  const productId = Number(params.id);
  const router = useRouter();
  const carriedRef = useRef<CarriedProduct | null | undefined>(null);
  if (carriedRef.current === null) carriedRef.current = takeProduct(productId);
  const carried = carriedRef.current ?? undefined;
  const product: Product | undefined = carried?.product;
  const type: 'food' | 'grocery' = (params.service as 'food' | 'grocery') ?? carried?.type ?? 'grocery';

  const groups = useMemo(() => (product ? activeOptionGroups(product) : []), [product]);
  const needsOptions = !!product && needsOptionSelection(product);

  const [selected, setSelected] = useState<Record<number, number[]>>(() => {
    if (!product) return {};
    return Object.fromEntries(groups.map((g) => [g.id, defaultSelections(g)]));
  });
  const [quantity, setQuantity] = useState(1);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const { submit, isPending } = useCartAdd();

  const unitPrice = useMemo(() => (product ? unitPricePreview(product, selected) : 0), [product, selected]);
  const total = Math.round(unitPrice * quantity * 100) / 100;

  const canSubmit = groups.every((group) => {
    const ids = selected[group.id] ?? [];
    return ids.length >= groupMinSelect(group) && ids.length <= groupMaxSelect(group);
  });

  if (!product) {
    return (
      <Screen header={<AppHeader variant="dark" title="Product" />}>
        <View style={styles.notFound}>
          <EmptyState
            title="Product not found"
            message={`We couldn't find product #${productId}. Browse from a store or search instead.`}
            actionLabel="Go to search"
            onAction={() => router.replace('/search' as never)}
          />
        </View>
      </Screen>
    );
  }

  const off = discountPercent(product);
  const hasOffer = off !== null;
  const accent = type === 'grocery' ? colors.success : colors.food[600];
  const compare = product.compare_at_price ? parseFloat(product.compare_at_price) : null;
  const price = parseFloat(product.price);
  const hasDiscount = compare !== null && compare > price;

  const selectSingle = (groupId: number, optionId: number) => {
    setError(null);
    setSelected((prev) => ({ ...prev, [groupId]: [optionId] }));
  };

  const toggleMultiple = (group: OptionGroup, optionId: number) => {
    setError(null);
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= groupMaxSelect(group)) return prev;
      return { ...prev, [group.id]: [...current, optionId] };
    });
  };

  const handleAdd = () => {
    const payload: { group_id: number; option_id: number }[] = [];
    for (const group of groups) {
      const ids = selected[group.id] ?? [];
      const min = groupMinSelect(group);
      const max = groupMaxSelect(group);
      if (ids.length === 0 && min > 0) {
        setError(`Please select "${group.name}".`);
        return;
      }
      if (ids.length < min) {
        setError(`Please select at least ${min} option(s) for "${group.name}".`);
        return;
      }
      if (ids.length > max) {
        setError(`You can select at most ${max} option(s) for "${group.name}".`);
        return;
      }
      for (const id of ids) payload.push({ group_id: group.id, option_id: id });
    }

    submit(
      { product_id: product.id, quantity, cart_type: type, selected_options: payload },
      {
        productName: product.name,
        onSuccess: () => {
          toast('Added to cart');
          router.back();
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Could not add to cart';
          setError(msg);
          toast(msg, 'error');
        },
      }
    );
  };

  const showConfig = needsOptions || product.product_type === 'variable';

  return (
    <Screen
      header={<AppHeader variant="dark" title={product.name} />}
      bottomBar={
        showConfig ? (
          <View style={styles.footer}>
            <View style={styles.qtyStepper}>
              <Pressable
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                style={[styles.qtyBtn, quantity <= 1 && { opacity: 0.4 }]}
                accessibilityLabel="Decrease quantity"
              >
                <Minus size={14} color={colors.neutral[700]} />
              </Pressable>
              <Text style={styles.qtyText}>{quantity}</Text>
              <Pressable
                onPress={() => setQuantity((q) => q + 1)}
                style={[styles.qtyBtn, { backgroundColor: accent }]}
                accessibilityLabel="Increase quantity"
              >
                <Plus size={14} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.footerTotal}>{formatCurrency(total)}</Text>
            <Pressable
              style={[styles.addBtn, { backgroundColor: accent }, (!canSubmit || isPending) && { opacity: 0.5 }]}
              disabled={!canSubmit || isPending}
              onPress={handleAdd}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.addBtnText}>Add item {formatCurrency(total)}</Text>
              )}
            </Pressable>
          </View>
        ) : undefined
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.coverWrap}>
          <ProductImage src={product.image ?? ''} style={styles.cover} rounded={false} />
          {hasOffer && (
            <View style={styles.offBadge}>
              <Text style={styles.offBadgeText}>{off}% off</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{product.name}</Text>
          {product.unit_label ? <Text style={styles.unitLabel}>{product.unit_label}</Text> : null}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCurrency(price)}</Text>
            {hasDiscount && <Text style={styles.compare}>{formatCurrency(compare as number)}</Text>}
            {!needsOptions && (
              <View style={styles.inlineAdd}>
                <AddToCartControl productId={product.id} type={type} size="md" product={product} />
              </View>
            )}
          </View>
        </View>

        {showConfig && (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Tag size={16} color={colors.neutral[400]} />
              <Text style={styles.cardHeadText}>Customize</Text>
            </View>
            <View style={styles.groups}>
              {groups.map((group) => {
                const min = groupMinSelect(group);
                const values = (group.values ?? []).slice();
                const isOpen = expanded[group.id] ?? false;
                const visible = values.length > COLLAPSE_THRESHOLD && !isOpen ? values.slice(0, COLLAPSE_THRESHOLD) : values;
                const hiddenCount = values.length - visible.length;
                return (
                  <View key={group.id}>
                    <View style={styles.groupHead}>
                      <View style={styles.groupTitleRow}>
                        <Text style={styles.groupName}>{group.name}</Text>
                        {min > 0 && (
                          <View style={styles.required}>
                            <Text style={styles.requiredText}>Required</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.groupRule}>{selectionRule(group)}</Text>
                    </View>

                    {visible.map((value: ProductOption) => {
                      const vPrice = optionPrice(value);
                      const active = (selected[group.id] ?? []).includes(value.id);
                      const available = optionAvailable(value);
                      const maxed =
                        !groupIsSingle(group) &&
                        !active &&
                        (selected[group.id] ?? []).length >= groupMaxSelect(group);
                      const disabled = !available || maxed;
                      return (
                        <Pressable
                          key={value.id}
                          onPress={() => {
                            if (disabled) return;
                            if (groupIsSingle(group)) selectSingle(group.id, value.id);
                            else toggleMultiple(group, value.id);
                          }}
                          style={({ pressed }) => [styles.optionRow, disabled && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
                        >
                          {groupIsSingle(group) ? (
                            <View style={[styles.radio, active && { borderColor: accent }]}>
                              {active ? <View style={[styles.radioDot, { backgroundColor: accent }]} /> : null}
                            </View>
                          ) : (
                            <View style={[styles.check, active && { backgroundColor: accent, borderColor: accent }]}>
                              {active && <Text style={styles.checkMark}>✓</Text>}
                            </View>
                          )}
                          <Text style={[styles.optionName, active && { fontWeight: '700', color: colors.ink[900] }]} numberOfLines={2}>
                            {value.name}
                          </Text>
                          {vPrice > 0 && <Text style={styles.optionPrice}>{formatCurrency(vPrice)}</Text>}
                        </Pressable>
                      );
                    })}
                    {hiddenCount > 0 && (
                      <Pressable onPress={() => setExpanded((prev) => ({ ...prev, [group.id]: true }))}>
                        <Text style={[styles.more, { color: accent }]}>+{hiddenCount} more</Text>
                      </Pressable>
                    )}
                    <View style={styles.groupDivider} />
                  </View>
                );
              })}
              {error && <Text style={styles.error}>{error}</Text>}
            </View>
          </View>
        )}

        {product.description ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Info size={16} color={colors.neutral[400]} />
              <Text style={styles.cardHeadText}>Description</Text>
            </View>
            <Text style={styles.desc}>{product.description}</Text>
          </View>
        ) : null}

        {(product.preparation_time_min || product.tax_rate != null) && (
          <View style={styles.metaGrid}>
            {product.preparation_time_min ? (
              <View style={styles.metaCard}>
                <Clock size={16} color={colors.neutral[400]} />
                <View>
                  <Text style={styles.metaLabel}>Prep time</Text>
                  <Text style={styles.metaValue}>{product.preparation_time_min} min</Text>
                </View>
              </View>
            ) : null}
            {product.tax_rate != null && Number(product.tax_rate) > 0 ? (
              <View style={styles.metaCard}>
                <Tag size={16} color={colors.neutral[400]} />
                <View>
                  <Text style={styles.metaLabel}>Tax</Text>
                  <Text style={styles.metaValue}>{product.tax_rate}%</Text>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  notFound: {
    padding: 24,
  },
  coverWrap: {
    aspectRatio: 4 / 3,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.neutral[100],
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  offBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colors.food[600],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  offBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  body: {
    paddingHorizontal: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink[900],
  },
  unitLabel: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink[900],
  },
  compare: {
    fontSize: 14,
    color: colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  inlineAdd: {
    marginLeft: 'auto',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 16,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardHeadText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  groups: {
    gap: 4,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[900],
  },
  required: {
    backgroundColor: withAlpha(colors.danger, 0.1),
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.danger,
  },
  groupRule: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.neutral[400],
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },
  optionName: {
    flex: 1,
    fontSize: 14,
    color: colors.neutral[700],
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  more: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },
  groupDivider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginVertical: 4,
  },
  error: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
    color: colors.danger,
  },
  desc: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[500],
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metaCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 12,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[800],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    backgroundColor: '#fff',
    padding: 4,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  footerTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  addBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});