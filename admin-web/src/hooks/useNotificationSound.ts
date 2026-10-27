import { useEffect, useRef } from 'react';
import type { SoundName } from '@/lib/notificationSound';
import { playNotificationSound } from '@/lib/notificationSound';

interface Identified {
  id: number | string;
}

interface Tracker {
  seeded: boolean;
  seen: Set<string>;
}

/**
 * Per-account playback tracker. Keyed by the authenticated account so a
 * different user logging into the same tab starts from a clean baseline
 * instead of inheriting another account's "known" ids.
 */
const trackers = new Map<string, Tracker>();
const MAX_TRACKERS = 16;

function trackerFor(identity: string): Tracker {
  let tracker = trackers.get(identity);
  if (!tracker) {
    tracker = { seeded: false, seen: new Set() };
    trackers.set(identity, tracker);
  }
  while (trackers.size > MAX_TRACKERS) {
    const oldest = trackers.keys().next().value;
    if (typeof oldest !== 'string' || oldest === identity) break;
    trackers.delete(oldest);
  }
  return tracker;
}

/**
 * Plays a notification sound whenever genuinely new entities appear in a feed
 * and never for the ones that were already known.
 *
 * The feed is the single source of truth for what the dashboard has already
 * shown: the first batch (first page load, a login, a refresh) is treated as
 * already-known — no soundtrack on boot. Every later diff is compared against
 * the known ids by their stable identity, so nothing replays on refetch,
 * navigation, or reconnect, and a status/payment/dispatch update on a known
 * order is silent. Only a brand-new id triggers the sound, exactly once. A
 * boot with an empty feed seeds nothing, so the first order to arrive on a
 * quiet queue is still treated as genuinely new and does chime.
 *
 * All state lives at module scope (per `identity`), intentionally outside
 * React, so effect remounts, StrictMode double-invocations and route changes
 * can never make a sound fire twice for the same record.
 */
export function useNotificationSound<T extends Identified>(
  items: T[] | undefined,
  sound: SoundName,
  identity: string,
): void {
  const itemsRef = useRef(items);
  if (items !== itemsRef.current) itemsRef.current = items;

  const idsKey = (items ?? []).map((i) => String(i.id)).join('|');

  useEffect(() => {
    if (!identity) return;
    const list = itemsRef.current;
    if (!list) return;

    const tracker = trackerFor(identity);
    if (!tracker.seeded) {
      // First observation. Everything shown now is already-known and must not
      // chime, but an empty feed means nothing was known yet — the first later
      // arrival is genuinely new and must.
      for (const item of list) tracker.seen.add(String(item.id));
      tracker.seeded = true;
      return;
    }

    for (const item of list) {
      const id = String(item.id);
      if (!tracker.seen.has(id)) {
        tracker.seen.add(id);
        playNotificationSound(sound);
      }
    }
    // idsKey, identity and sound are the only inputs that change behaviour.
  }, [idsKey, identity, sound]);
}