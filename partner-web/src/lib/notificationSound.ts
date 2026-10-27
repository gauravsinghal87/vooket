/**
 * Browser notification sounds.
 *
 * The two MP3 assets live in the app's `public/sounds/` folder and are served
 * from the browser public paths `/sounds/new_order.mp3` and
 * `/sounds/notification.mp3`. Each file is loaded once into a reused Audio
 * element so playback starts quickly and we never leak a new instance per
 * event.
 *
 * Autoplay policy: a sound is only guaranteed to play after the user has
 * interacted with the page. We prime both assets (silently, at zero volume)
 * on the first pointer/key/touch interaction so the browser marks them as
 * playable, and every later play() rejection is swallowed — a blocked sound
 * never touches the delivery flows themselves.
 */

export type SoundName = 'new_order' | 'notification';

const SOUND_PATHS: Record<SoundName, string> = {
  new_order: '/sounds/new_order.mp3',
  notification: '/sounds/notification.mp3',
};

/** Sensible, non-intrusive playback volume (no backend preference exists). */
const DEFAULT_VOLUME = 0.55;

const elements = new Map<SoundName, HTMLAudioElement>();

function audioElement(name: SoundName): HTMLAudioElement {
  let el = elements.get(name);
  if (!el) {
    el = new Audio(SOUND_PATHS[name]);
    el.preload = 'auto';
    el.volume = DEFAULT_VOLUME;
    elements.set(name, el);
  }
  return el;
}

let unlockArmed = false;
let unlockComplete = false;

/**
 * Preload/unlock both sounds inside the first real user gesture. The prime
 * plays the files at zero volume and immediately stops them, which is the
 * standard way to satisfy autoplay without bypassing browser security.
 */
function primeSound(name: SoundName): void {
  const el = audioElement(name);
  const previousVolume = el.volume;
  el.volume = 0;
  const attempt = el.play();
  if (attempt !== undefined) {
    attempt
      .then(() => {
        el.pause();
        el.currentTime = 0;
      })
      .catch(() => {
        // Browser has not granted audio access yet — ignore.
      })
      .finally(() => {
        el.volume = previousVolume;
      });
  }
}

function armUnlock(): void {
  if (unlockArmed || unlockComplete) return;

  const onGesture = (): void => {
    if (unlockComplete) return;
    unlockComplete = true;
    cleanup();
    (Object.keys(SOUND_PATHS) as SoundName[]).forEach(primeSound);
  };
  const cleanup = (): void => {
    window.removeEventListener('pointerdown', onGesture, { capture: true });
    window.removeEventListener('keydown', onGesture, { capture: true });
    window.removeEventListener('touchstart', onGesture, { capture: true });
  };

  unlockArmed = true;
  window.addEventListener('pointerdown', onGesture, { capture: true });
  window.addEventListener('keydown', onGesture, { capture: true });
  window.addEventListener('touchstart', onGesture, { capture: true });
}

/**
 * A few new requests arriving in the same moment should produce a short,
 * bounded alert sequence — never one Audio element or chime per request.
 * Within a 2.5s window we play once immediately and at most one follow-up
 * chime; the rest of the burst is absorbed.
 */
const BURST_WINDOW_MS = 2500;
const BURST_REPLAY_DELAY_MS = 500;
let lastStartedAt = 0;
let replayTimer: number | null = null;

function startPlayback(name: SoundName): void {
  const el = audioElement(name);
  try {
    el.currentTime = 0;
  } catch {
    // Fresh element before first load — nothing to seek back yet.
  }
  const attempt = el.play();
  if (attempt !== undefined) attempt.catch(() => {});
}

export function playNotificationSound(name: SoundName): void {
  if (typeof window === 'undefined') return;
  armUnlock();

  const now = Date.now();
  if (now - lastStartedAt >= BURST_WINDOW_MS) {
    lastStartedAt = now;
    startPlayback(name);
    return;
  }

  if (replayTimer === null) {
    replayTimer = window.setTimeout(() => {
      replayTimer = null;
      lastStartedAt = Date.now();
      startPlayback(name);
    }, BURST_REPLAY_DELAY_MS);
  }
}