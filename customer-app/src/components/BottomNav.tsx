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
        <BlurView intensity={30} tint="dark" style={styles.blurContainer}>
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
  overlay: {
    backgroundColor: 'rgba(25, 25, 25, 0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 999,
  },
  glassFallback: {
    backgroundColor: 'rgba(25, 25, 25, 0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
