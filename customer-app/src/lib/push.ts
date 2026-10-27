import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { user as userRepo } from '@/api/repositories';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1b66f5',
        });
      } catch {
        // ignore
      }
    }

    // In Expo Go (SDK 53+) remote notifications are not supported on Android;
    // use Expo Push Token when available in dev/standalone builds, otherwise skip.
    let tokenData: any = null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    try {
      tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    } catch (e) {
      console.warn('expo-notifications: getExpoPushTokenAsync failed (likely Expo Go/unsupported env)', e);
      try {
        if (Device.isDevice) {
          tokenData = await Notifications.getDevicePushTokenAsync();
        }
      } catch (e2) {
        console.warn('expo-notifications: getDevicePushTokenAsync failed', e2);
        return null;
      }
    }

    const token = tokenData?.data || tokenData?.token || null;
    return token;
  } catch (e) {
    console.warn('registerForPush error (non-fatal)', e);
    return null;
  }
}

export async function initCustomerAppPush() {
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      try {
        await (userRepo as any).registerPushToken?.({
          token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          app_id: 'customer_app',
          device_type: Device.modelName || undefined,
        });
      } catch (e) {
        // ignore
      }
    }
    return token;
  } catch (e) {
    console.warn('init app push error (non-fatal)', e);
    return null;
  }
}
