import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ModalProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors } from '@/shared/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  showHandle?: boolean;
  showClose?: boolean;
  /** Optional node rendered in the header, left of the close button. */
  headerRight?: React.ReactNode;
  maxHeight?: ViewStyle['maxHeight'];
  /** When true, the body scrolls within the sheet's max height. */
  scrollable?: boolean;
  /** Optional fixed footer rendered below the (scrollable) body. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  presentationStyle?: ModalProps['presentationStyle'];
  /** Lift the sheet above the keyboard (iOS) so inputs/footers stay reachable. */
  keyboardAware?: boolean;
}

/**
 * A lightweight Modal-based bottom sheet — the native stand-in for the web
 * app's dialog sheets. Mounted per screen; slides up from the bottom with a
 * tappable backdrop.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  showHandle = true,
  showClose = true,
  headerRight,
  maxHeight = '88%',
  scrollable = false,
  footer,
  children,
  presentationStyle,
  keyboardAware = false,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(600);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 240 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 620, duration: 180, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose, translateY, backdropOpacity]);

  const sheet = (
    <Animated.View
      style={[
        styles.sheet,
        { maxHeight, paddingBottom: Math.max(insets.bottom, 12), transform: [{ translateY }] },
      ]}
    >
      {showHandle && <View style={styles.handle} />}
      {(title || showClose) && (
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {headerRight}
          {showClose && (
            <Pressable onPress={close} hitSlop={10} style={styles.closeBtn} accessibilityLabel="Close sheet">
              <X size={20} color={colors.neutral[500]} />
            </Pressable>
          )}
        </View>
      )}
      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Animated.View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
      presentationStyle={presentationStyle}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        </Animated.View>
        {keyboardAware ? (
          <KeyboardAvoidingView
            style={styles.keyboardAware}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {sheet}
          </KeyboardAvoidingView>
        ) : (
          sheet
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardAware: {
    width: '100%',
  },
  backdrop: {
    backgroundColor: 'rgba(16,14,10,0.5)',
  },
  sheet: {
    flexDirection: 'column',
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[200],
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 12,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink[900],
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.neutral[500],
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ink[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingBottom: 8,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.ink[50],
    paddingTop: 12,
  },
});