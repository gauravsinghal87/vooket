import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme';

export function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 56 : size === 'sm' ? 28 : 40;
  const initials = (name || 'G')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={[styles.avatar, { width: dim, height: dim, borderRadius: dim / 2 }]}>
      <Text style={[styles.initials, { fontSize: size === 'lg' ? 18 : size === 'sm' ? 12 : 15 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '800',
  },
});