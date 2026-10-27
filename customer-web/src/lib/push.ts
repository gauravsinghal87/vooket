import { getFirebaseApp, getFirebaseMessaging, onFcmMessage, requestFcmToken } from './firebase';
import { apiClient } from './apiClient';

export async function initCustomerWebPush(config: any, _userId?: number | string) {
  try {
    if (typeof window === 'undefined') return null;
    if (!config?.enabled || !config?.firebase?.apiKey) return null;

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } catch (e) {
        // ignore
      }
    }

    const app = await getFirebaseApp(config.firebase);
    if (!app) return null;
    const messaging = await getFirebaseMessaging(app);
    if (!messaging) return null;

    // Get token
    const token = await requestFcmToken(messaging, config.firebase.vapidKey || undefined);
    if (token) {
      try {
        // Use repository via direct call
        await apiClient.post('/push-tokens', {
          token,
          platform: 'web',
          app_id: 'customer_web',
          device_type: navigator.userAgent,
        });
      } catch (e) {
        // ignore registration errors
      }
    }

    // Foreground messages
    onFcmMessage(messaging, (payload) => {
      try {
        const title = payload?.notification?.title || payload?.data?.title || 'Notification';
        const body = payload?.notification?.body || payload?.data?.body || '';
        if (Notification.permission === 'granted') {
          new Notification(title, { body, data: payload?.data });
        }
      } catch (e) {
        // ignore
      }
    });

    return token;
  } catch (e) {
    console.error('push init error', e);
    return null;
  }
}
