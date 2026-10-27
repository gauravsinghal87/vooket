import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { repositories } from '@/api/repositories';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { colors } from '@/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [countryCode, setCountryCode] = useState(user?.country_code ?? '91');

  const update = useMutation({
    mutationFn: () =>
      repositories.user.updateProfile({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        country_code: countryCode,
      }),
    onSuccess: (updated) => {
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ['auth-profile'] });
      toast('Profile updated');
      router.back();
    },
    onError: () => toast("Couldn't update profile", 'error'),
  });

  return (
    <Screen header={<AppHeader variant="dark" title="Edit profile" />} bottomNav={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.avatarWrap}>
          <Avatar name={name || 'User'} size="lg" />
          <Text style={styles.avatarHint}>Profile photo coming soon</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Full name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.neutral[400]} style={styles.input} />

          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.neutral[400]} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

          <Text style={styles.label}>Phone</Text>
          <View style={styles.phoneRow}>
            <TextInput value={countryCode} onChangeText={setCountryCode} keyboardType="number-pad" style={[styles.input, styles.codeInput]} />
            <TextInput value={phone} onChangeText={setPhone} placeholder="Phone number" placeholderTextColor={colors.neutral[400]} style={[styles.input, styles.phoneInput]} keyboardType="phone-pad" />
          </View>

          <Pressable style={[styles.saveBtn, update.isPending && { opacity: 0.6 }]} onPress={() => update.mutate()} disabled={update.isPending}>
            {update.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveText}>Save Changes</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.hint}>You'll need to re-verify your email or phone if you change them.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarWrap: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  },
  avatarHint: {
    fontSize: 12,
    color: colors.neutral[400],
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    padding: 16,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink[800],
    marginTop: 8,
  },
  input: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.ink[900],
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
  },
  codeInput: {
    width: 76,
  },
  phoneInput: {
    flex: 1,
  },
  saveBtn: {
    marginTop: 18,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  hint: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 12,
    color: colors.neutral[400],
  },
});