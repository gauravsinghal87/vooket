import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AppHeader } from '@/shared/components/AppHeader';
import { BottomNav } from '@/shared/components/BottomNav';
import { colors } from '@/shared/theme';

interface ScreenProps {
  /** 'auto' renders AppHeader (themed on top routes, dark elsewhere); a node is rendered as-is; null skips. */
  header?: React.ReactNode | 'auto' | null;
  children: React.ReactNode;
  bottomBar?: React.ReactNode;
  bottomNav?: boolean;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: ScrollViewProps;
  padded?: boolean;
  /** Root background. Defaults to the warm ink-50 canvas; grocery screens use grocery-50. */
  background?: string;
  /**
   * Node pinned over the top of the scroll area, outside the ScrollView so it
   * does not scroll (Food's two-stage sticky header). The wrapper ignores
   * touches, so only the controls inside it capture them.
   */
  overlay?: React.ReactNode;
  /**
   * Node rendered between the header and the scroll body, in normal layout
   * flow, so it never scrolls away. Native alternative to web CSS
   * `position: sticky` (Grocery's pinned category strip). Because it is a
   * sibling of the ScrollView, scrolled content can never slide beneath it and
   * there is always exactly one instance on screen.
   */
  stickyHeader?: React.ReactNode;
}

/**
 * The shared page shell (native port of web AppShell + layout).
 * Header at top, scrollable content on ink-50, optional bottom bar and the
 * primary BottomNav. Keyboards are pushed up on iOS.
 */
export function Screen({
  header = 'auto',
  children,
  bottomBar,
  bottomNav = true,
  scroll = true,
  contentStyle,
  scrollProps,
  padded = true,
  background,
  overlay,
  stickyHeader,
}: ScreenProps) {
  const body = (
    <>
      {header !== null && (header === 'auto' ? <AppHeader /> : header)}
      {stickyHeader}
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            padded && { paddingBottom: 24 + (bottomBar ? 88 : 0) + (bottomNav ? 90 : 0) },
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fixed, contentStyle]}>{children}</View>
      )}
    </>
  );

  return (
    /* No root bottom padding for `bottomNav`: the dock is laid out in normal
       flow and already pads itself for the safe area, so reserving space here
       too would leave a coloured strip hanging below the dock instead of it
       running flush to the screen edge. */
    <KeyboardAvoidingView
      style={[styles.root, background ? { backgroundColor: background } : null]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
      {overlay ? (
        <View style={styles.overlay} pointerEvents="box-none">
          {overlay}
        </View>
      ) : null}
      {bottomBar ? (
        <View style={[styles.bottomBarWrap, bottomNav && { paddingBottom: 16 + 90 }]}>
          {bottomBar}
        </View>
      ) : null}
      {bottomNav ? <BottomNav /> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink[50],
  },
  scroll: {
    flex: 1,
  },
  fixed: {
    flex: 1,
    /* Let fixed-body screens own nested scroll regions without overflowing. */
    minHeight: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  bottomBarWrap: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.ink[100],
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
});