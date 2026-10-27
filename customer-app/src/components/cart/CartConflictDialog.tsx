import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react-native';
import { repositories } from '@/api/repositories';
import { useCartConflictStore } from '@/stores/cartConflictStore';
import { colors, withAlpha } from '@/theme';

/**
 * The single, app-wide cross-restaurant replacement confirmation.
 *
 * Mounted once (in the root layout) so it is independent of whichever menu
 * control triggered the conflict. It owns the ordered clear-then-add sequence,
 * guards against duplicate submissions, and keeps the origin UI's `onAdded`
 * callback until the replacement actually succeeds.
 */
export function CartConflictDialog() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const pending = useCartConflictStore((s) => s.pending);
  const processing = useCartConflictStore((s) => s.processing);
  const close = useCartConflictStore((s) => s.close);
  const setProcessing = useCartConflictStore((s) => s.setProcessing);

  const [error, setError] = useState<string | null>(null);
  // Guards against a second confirmation firing before `processing` has
  // propagated through the store (a very fast double tap).
  const runningRef = useRef(false);

  useEffect(() => {
    if (pending) setError(null);
  }, [pending]);

  // Mount the Modal only while a conflict is pending. Besides avoiding a hidden
  // always-present overlay, this guarantees the dialog's Modal is created after
  // any already-open sheet (e.g. the product configurator), so it stacks above
  // it — on react-native-web portals are ordered by mount time.
  if (!pending) return null;

  const grocery = pending.payload.cart_type === 'grocery';
  const accent = grocery ? colors.grocery[500] : colors.food[600];
  const accentText = grocery ? colors.ink[900] : '#fff';

  const handleCancel = () => {
    if (processing || runningRef.current) return;
    close();
  };

  const handleConfirm = async () => {
    if (!pending || processing || runningRef.current) return;
    runningRef.current = true;
    setProcessing(true);
    setError(null);

    // 1) Clear first and treat any failure as fatal: never add on top of a cart
    //    that still belongs to the other restaurant.
    try {
      await repositories.cart.clear();
    } catch {
      runningRef.current = false;
      setProcessing(false);
      setError('We could not clear your existing cart, so nothing was changed. Please try again.');
      return;
    }

    // 2) Add the preserved request. On failure the cart is already empty, so
    //    report the partial state and resync the UI with the server.
    try {
      const cart = await repositories.cart.addItem(pending.payload);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      pending.onAdded?.(cart);
      runningRef.current = false;
      setProcessing(false);
      close();
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      runningRef.current = false;
      setProcessing(false);
      const detail = err instanceof Error && err.message ? ` ${err.message}` : '';
      setError(
        `Your previous cart was cleared, but we could not add this item.${detail} Please try again.`
      );
    }
  };

  const itemLabel = pending.productName ? `“${pending.productName}”` : 'this item';

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleCancel}
          accessibilityLabel="Close"
        />
        <View
          style={[
            styles.card,
            { marginBottom: Math.max(insets.bottom, 16) },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.head}>
            <View style={[styles.iconWrap, { backgroundColor: withAlpha(accent, 0.1) }]}>
              <ShoppingBag size={22} color={accent} />
            </View>
            <Text style={styles.title}>Replace your cart?</Text>
          </View>

          <Text style={styles.body}>
            Your cart contains items from another restaurant. Would you like to clear your existing
            cart and add {itemLabel} instead?
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: withAlpha(colors.danger, 0.1) }]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={handleCancel}
              disabled={processing}
              accessibilityLabel="Cancel"
              style={({ pressed }) => [
                styles.btn,
                styles.cancelBtn,
                pressed && styles.pressed,
                processing && styles.disabled,
              ]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={processing}
              accessibilityLabel="Clear cart and add item"
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: accent },
                pressed && styles.pressed,
                processing && styles.disabled,
              ]}
            >
              {processing ? (
                <ActivityIndicator size="small" color={accentText} />
              ) : (
                <Text style={[styles.confirmText, { color: accentText }]}>Clear cart & add item</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(16,14,10,0.5)',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink[900],
  },
  body: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[500],
  },
  errorBox: {
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.55,
  },
});
