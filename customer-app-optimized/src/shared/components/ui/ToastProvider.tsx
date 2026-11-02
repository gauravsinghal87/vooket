import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore, type ToastType } from '@/shared/stores/toastStore';
import { colors } from '@/shared/theme';

const TYPE_STYLES: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: colors.success, icon: '\u2713' },
  error: { bg: colors.danger, icon: '\u2715' },
  info: { bg: colors.brand[700], icon: 'i' },
  default: { bg: colors.ink[900], icon: '' },
};

export function ToastProvider() {
  const insets = useSafeAreaInsets();
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  return (
    <View pointerEvents="box-none" style={[styles.container, { top: insets.top + 8 }]}>
      {toasts.map((t) => {
        const style = TYPE_STYLES[t.type];
        return (
          <Pressable
            key={t.id}
            onPress={() => dismissToast(t.id)}
            style={[styles.toast, { backgroundColor: style.bg }]}
          >
            {style.icon ? (
              <Text style={styles.icon}>{style.icon}</Text>
            ) : null}
            <Text style={styles.message}>{t.message}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  icon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    width: 18,
    textAlign: 'center',
  },
  message: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});