import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export async function getFirebaseApp(config: any): Promise<FirebaseApp | null> {
  if (!config?.apiKey || !config?.projectId || !config?.appId) return null;
  try {
    if (getApps().length) {
      app = getApp();
    } else {
      app = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
        projectId: config.projectId,
        storageBucket: config.storageBucket || `${config.projectId}.appspot.com`,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      });
    }
    return app;
  } catch (e) {
    console.error('firebase init error', e);
    return null;
  }
}

export async function getFirebaseMessaging(appInstance: FirebaseApp): Promise<Messaging | null> {
  try {
    const supported = await isSupported();
    if (!supported) return null;
    if (!messaging) {
      messaging = getMessaging(appInstance);
    }
    return messaging;
  } catch (e) {
    console.error('firebase messaging error', e);
    return null;
  }
}

export async function requestFcmToken(messagingInstance: Messaging, vapidKey?: string): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const token = await getToken(messagingInstance, vapidKey ? { vapidKey } : undefined);
    return token || null;
  } catch (e) {
    console.error('fcm token error', e);
    return null;
  }
}

export function onFcmMessage(messagingInstance: Messaging, cb: (payload: any) => void) {
  try {
    return onMessage(messagingInstance, cb);
  } catch (e) {
    console.error('onMessage error', e);
    return () => {};
  }
}
