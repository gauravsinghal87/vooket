import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
} from '@expo-google-fonts/outfit';
import { ToastProvider } from '@/shared/components/ui/ToastProvider';
import { CartConflictDialog } from '@/features/cart/components/CartConflictDialog';
import { useAuthStore } from '@/features/auth/store/authStore';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Zomato's typeface. The food-module styles reference these faces by name
    // (`fontFamily: 'Outfit'`); everything else keeps the system default.
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });

  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    useAuthStore.getState().initialize();
  }, []);

  useEffect(() => {
    if (fontsLoaded && initialized) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, initialized]);

  if (!fontsLoaded || !initialized) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color="#1b66f5" size="large" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f7f6f4' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="food/index" />
          <Stack.Screen name="grocery/index" />
          <Stack.Screen name="rides/index" />
          <Stack.Screen name="rides/destination" />
          <Stack.Screen name="rides/confirm-pickup" />
          <Stack.Screen name="restaurants/index" />
          <Stack.Screen name="restaurant/[id]" />
          <Stack.Screen name="stores/index" />
          <Stack.Screen name="store/[id]" />
          <Stack.Screen name="product/[id]" />
          <Stack.Screen name="search" />
          <Stack.Screen name="cart" />
          <Stack.Screen name="checkout" />
          <Stack.Screen name="order-confirmation/[id]" />
          <Stack.Screen name="orders" />
          <Stack.Screen name="order/[id]" />
          <Stack.Screen name="ride/[id]" />
          <Stack.Screen name="wallet" />
          <Stack.Screen name="profile/index" />
          <Stack.Screen name="profile/edit" />
          <Stack.Screen name="profile/payments" />
          <Stack.Screen name="profile/addresses" />
          <Stack.Screen name="food/profile/addresses" />
          <Stack.Screen name="grocery/profile/addresses" />
          <Stack.Screen name="map-picker" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/register" />
          <Stack.Screen name="auth/forgot" />
          <Stack.Screen name="auth/otp" />
          <Stack.Screen name="auth/reset" />
        </Stack>
        <ToastProvider />
        <CartConflictDialog />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f6f4',
  },
});