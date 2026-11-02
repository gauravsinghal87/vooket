import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Info, Minus, Plus } from 'lucide-react-native';
import type { OptionGroup, Product, ProductOption } from '@/shared/types/catalog';
import {
  activeOptionGroups,
  defaultSelections,
  groupIsSingle,
  groupMaxSelect,
  groupMinSelect,
  optionAvailable,
  optionPrice,
  unitPricePreview,
} from '@/shared/utils/productOptions';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { ProductImage } from '@/shared/components/ui/ProductImage';
import { VegMark } from '@/shared/components/ui/primitives';
import { useCartAdd } from '@/features/cart/hooks/useCart';
import { toast } from '@/shared/stores/toastStore';
import { discountPercent, formatCurrency } from '@/shared/utils/utils';
import { colors, withAlpha } from '@/shared/theme';

const COLLAPSE_THRESHOLD = 3;

/** Max length of Zomato's per-item "cooking request" note. */
const NOTE_MAX = 100;

/** Zomato's group caption: `Required • Select any 1 option`. */
function groupSubtitle(group: OptionGroup): string {
  const min = groupMinSelect(group);
  const max = groupMaxSelect(group);
  const need = min > 0 ? 'Required' : 'Optional';
  let rule: string;
  if (groupIsSingle(group)) rule = 'Select any 1 option';
  else if (min === max) rule = `Select ${min} option${min > 1 ? 's' : ''}`;
  else if (min > 0) rule = `Select any ${min}–${max} options`;
  else rule = `Select up to ${max} options`;
  return `${need} • ${rule}`;
}

export interface ProductConfiguratorAddPayload {
  productId: number;
  quantity: number;
  selected_options: { group_id: number; option_id: number }[];
}

interface ProductConfiguratorSheetProps {
  product: Product;
  type: 'food' | 'grocery';
  visible: boolean;
  onClose: () => void;
  /** Restored selections for edit mode (group id -> option ids). */
  initialSelections?: Record<number, number[]>;
  /** Restored quantity for edit mode. */
  initialQuantity?: number;
  /** Called after a successful add so callers can reconcile an edited line. */
  onAdded?: (payload: ProductConfiguratorAddPayload) => void;
}

/**
 * Native port of customer-web's variable-product sheet
 * (components/product/variable-product-modal.tsx + product-configurator.tsx),
 * styled to match Zomato: group cards with a `Required • Select any 1 option`
 * caption, options with the price then a hard-right red radio/checkbox, an
 * optional "cooking request" note for food, and a Zomato footer (bordered
 * stepper + full-width red "Add item" carrying the struck compare price).
 */
export function ProductConfiguratorSheet({
  product,
  type,
  visible,
  onClose,
  initialSelections,
  initialQuantity,
  onAdded,
}: ProductConfiguratorSheetProps) {
  const groups = useMemo(() => activeOptionGroups(product), [product]);
  const [selected, setSelected] = useState<Record<number, number[]>>(() => {
    const base = Object.fromEntries(groups.map((g) => [g.id, defaultSelections(g)]));
    if (initialSelections) {
      for (const group of groups) {
        const valid = (initialSelections[group.id] ?? []).filter((id) =>
          (group.values ?? []).some((v) => v.id === id && optionAvailable(v))
        );
        if (valid.length) {
          base[group.id] = valid.slice(0, groupMaxSelect(group));
        }
      }
    }
    return base;
  });
  const [quantity, setQuantity] = useState(initialQuantity ?? 1);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { submit, isPending } = useCartAdd();

  const grocery = type === 'grocery';
  const accent = grocery ? colors.success : colors.food[600];
  const accentText = grocery ? colors.ink[900] : '#fff';
  const off = discountPercent(product);

  const unitPrice = useMemo(() => unitPricePreview(product, selected), [product, selected]);
  const total = Math.round(unitPrice * quantity * 100) / 100;

  // The struck-through original in the Add button: only when the product is
  // actually cheaper than its compare-at price.
  const compareAt = product.compare_at_price ? parseFloat(product.compare_at_price) : null;
  const hasDiscount = compareAt !== null && Number.isFinite(compareAt) && compareAt > parseFloat(product.price);
  const compareTotal = hasDiscount ? Math.round(compareAt * quantity * 100) / 100 : null;

  const canSubmit = groups.every((group) => {
    const ids = selected[group.id] ?? [];
    return ids.length >= groupMinSelect(group) && ids.length <= groupMaxSelect(group);
  });

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

    setError(null);
    submit(
      {
        product_id: product.id,
        quantity,
        cart_type: type,
        selected_options: payload,
        ...(type === 'food' && note.trim() ? { special_instructions: note.trim() } : {}),
      },
      {
        productName: product.name,
        onSuccess: () => {
          toast('Added to cart');
          onAdded?.({ productId: product.id, quantity, selected_options: payload });
          onClose();
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Could not add to cart';
          setError(msg);
          toast(msg, 'error');
        },
      }
    );
  };

  // Zomato's food footer: bordered stepper hard left, one full-width red
  // "Add item" button carrying the struck original and the effective total.
  const footer = (
    <View style={styles.footer}>
      <View style={[styles.stepper, { borderColor: grocery ? withAlpha(colors.success, 0.4) : colors.food[300] }]}>
        <Pressable
          onPress={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1}
          style={[styles.stepperBtn, quantity <= 1 && styles.stepperBtnDisabled]}
          accessibilityLabel="Decrease quantity"
        >
          <Minus size={16} color={grocery ? colors.success : colors.food[600]} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.stepperText}>{quantity}</Text>
        <Pressable
          onPress={() => setQuantity((q) => q + 1)}
          style={styles.stepperBtn}
          accessibilityLabel="Increase quantity"
        >
          <Plus size={16} color={grocery ? colors.success : colors.food[600]} strokeWidth={2.5} />
        </Pressable>
      </View>

      <Pressable
        style={[styles.addBtn, { backgroundColor: accent }, (!canSubmit || isPending) && styles.addBtnDisabled]}
        disabled={!canSubmit || isPending}
        onPress={handleAdd}
        accessibilityLabel="Add item"
      >
        {isPending ? (
          <ActivityIndicator size="small" color={accentText} />
        ) : (
          <View style={styles.addBtnRow}>
            <Text style={styles.addBtnText}>Add item</Text>
            {compareTotal !== null && (
              <Text style={styles.addBtnCompare}>{formatCurrency(compareTotal)}</Text>
            )}
            <Text style={styles.addBtnText}>{formatCurrency(total)}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={product.name}
      footer={footer}
      scrollable
      maxHeight="88%"
      keyboardAware
    >
      <View style={styles.summary}>
        <ProductImage src={product.image} style={styles.thumb} />
        <View style={styles.summaryText}>
          <View style={styles.badgeRow}>
            {product.is_veg !== null && <VegMark isVeg={product.is_veg} size={14} />}
            {off !== null && product.is_available && (
              <View style={[styles.offBadge, { backgroundColor: accent }]}>
                <Text style={[styles.offText, grocery && styles.offTextGrocery]}>{off}% off</Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>{formatCurrency(unitPrice)}</Text>
          {product.description ? (
            <Text style={styles.desc} numberOfLines={3}>
              {product.description}
            </Text>
          ) : null}
        </View>
      </View>

      {groups.length > 0 ? (
        <View style={styles.groups}>
          {groups.map((group) => {
            const values = group.values ?? [];
            const single = groupIsSingle(group);
            const isOpen = expanded[group.id] ?? false;
            const visibleValues =
              values.length > COLLAPSE_THRESHOLD && !isOpen ? values.slice(0, COLLAPSE_THRESHOLD) : values;
            const hiddenCount = values.length - visibleValues.length;

            return (
              <View key={group.id} style={styles.groupCard}>
                <View style={styles.groupHead}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupSubtitle}>{groupSubtitle(group)}</Text>
                </View>

                {visibleValues.map((value: ProductOption, idx: number) => {
                  const vPrice = optionPrice(value);
                  const active = (selected[group.id] ?? []).includes(value.id);
                  const available = optionAvailable(value);
                  const maxed =
                    !single && !active && (selected[group.id] ?? []).length >= groupMaxSelect(group);
                  const disabled = !available || maxed;
                  return (
                    <Pressable
                      key={value.id}
                      onPress={() => {
                        if (disabled) return;
                        if (single) selectSingle(group.id, value.id);
                        else toggleMultiple(group, value.id);
                      }}
                      style={({ pressed }) => [
                        styles.optionRow,
                        idx !== visibleValues.length - 1 && styles.optionRowBorder,
                        disabled && styles.optionRowDisabled,
                        pressed && styles.optionRowPressed,
                      ]}
                    >
                      {product.is_veg !== null && <VegMark isVeg={product.is_veg} size={14} />}
                      <Text
                        style={[styles.optionName, active && styles.optionNameActive]}
                        numberOfLines={2}
                      >
                        {value.name}
                      </Text>
                      {vPrice > 0 && <Text style={styles.optionPrice}>{formatCurrency(vPrice)}</Text>}
                      {single ? (
                        <View style={[styles.radio, active && { borderColor: accent }]}>
                          {active ? <View style={[styles.radioDot, { backgroundColor: accent }]} /> : null}
                        </View>
                      ) : (
                        <View style={[styles.check, active && { backgroundColor: accent, borderColor: accent }]}>
                          {active && <Text style={styles.checkMark}>✓</Text>}
                        </View>
                      )}
                    </Pressable>
                  );
                })}

                {hiddenCount > 0 && (
                  <Pressable onPress={() => setExpanded((prev) => ({ ...prev, [group.id]: true }))}>
                    <Text style={[styles.more, { color: accent }]}>+{hiddenCount} more</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      ) : null}

      {type === 'food' ? (
        <View style={styles.noteCard}>
          <View style={styles.noteHead}>
            <Text style={styles.noteTitle}>Add a cooking request (optional)</Text>
            <Info size={16} color={colors.neutral[400]} />
          </View>
          <View style={styles.noteInputWrap}>
            <TextInput
              value={note}
              onChangeText={(t) => setNote(t.slice(0, NOTE_MAX))}
              placeholder="e.g. Don't make it too spicy"
              placeholderTextColor={colors.neutral[400]}
              multiline
              style={styles.noteInput}
              aria-label="Cooking request"
            />
            <Text style={styles.noteCount}>{NOTE_MAX - note.length}</Text>
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 16,
  },
  offBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  offText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  offTextGrocery: {
    color: colors.ink[900],
  },
  name: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink[900],
  },
  price: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink[900],
  },
  desc: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.neutral[500],
  },
  groups: {
    gap: 10,
  },
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  groupHead: {
    marginBottom: 2,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink[900],
  },
  groupSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.neutral[500],
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  optionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[50],
  },
  optionRowDisabled: {
    opacity: 0.4,
  },
  optionRowPressed: {
    opacity: 0.7,
  },
  optionName: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: colors.neutral[700],
  },
  optionNameActive: {
    fontWeight: '700',
    color: colors.ink[900],
  },
  optionPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink[900],
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.food[300],
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
  more: {
    marginTop: 6,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  noteCard: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: '#fff',
    padding: 16,
  },
  noteHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  noteTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink[900],
  },
  noteInputWrap: {
    marginTop: 10,
  },
  noteInput: {
    minHeight: 74,
    borderRadius: 12,
    backgroundColor: colors.ink[50],
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.ink[900],
    textAlignVertical: 'top',
  },
  noteCount: {
    alignSelf: 'flex-end',
    marginTop: 4,
    fontSize: 11,
    fontWeight: '500',
    color: colors.neutral[400],
  },
  error: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '500',
    color: colors.danger,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  stepperBtn: {
    width: 40,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  stepperText: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  addBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  addBtnDisabled: {
    backgroundColor: colors.neutral[200],
  },
  addBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  addBtnCompare: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textDecorationLine: 'line-through',
  },
});
