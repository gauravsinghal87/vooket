import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { ServiceModuleSwitcher } from '@/components/ServiceModuleSwitcher';

export function BottomNav() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {Platform.OS === 'web' ? (
        <View style={styles.glassFallback}>
          <ServiceModuleSwitcher />
        </View>
      ) : (
        <BlurView intensity={40} tint="light" style={styles.blurContainer}>
          <View style={styles.overlay}>
            <ServiceModuleSwitcher />
          </View>
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  blurContainer: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  /* White glass: the light blur carries the frost, a translucent white plate
     over it keeps the pill readable on any content, and the hairline white
     border is what reads as the glass edge. */
  overlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 999,
  },
  glassFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
