import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { AppHeader } from '@/components/AppHeader';
import { ProductImage } from '@/components/ui/ProductImage';
import { imageUrl } from '@/lib/images';
import { bannerRoute } from '@/lib/banner';
import { HERO_THEMES, colors } from '@/theme';
import type { Banner } from '@/types/catalog';

const SCREEN_HEIGHT = Dimensions.get('window').height;
/* Compact, immersive height — tall enough for the overlaid header + copy, but
   leaving the first content section visible without scrolling. */
const HERO_MIN_HEIGHT = Math.round(Math.min(Math.max(SCREEN_HEIGHT * 0.4, 260), 320)) + 70;

const SCRIM = ['rgba(16,14,10,0.72)', 'rgba(16,14,10,0.32)', 'rgba(16,14,10,0.85)'] as const;

/**
 * The Admin-uploaded Food hero video. Muted, looping, full-bleed, and it only
 * plays while the Food screen is focused and the app is in the foreground, so
 * it never runs (or holds the decoder) on another screen or in the background.
 * On a playback error it renders nothing, leaving the poster image visible.
 */
function HeroVideo({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  const focusedRef = useRef(false);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.staysActiveInBackground = false;
    p.play();
  });

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') setFailed(true);
  });

  // Play only while Food is the focused screen.
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      player.play();
      return () => {
        focusedRef.current = false;
        player.pause();
      };
    }, [player])
  );

  // Pause in the background; resume on return only if the screen is still focused.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (focusedRef.current) player.play();
      } else {
        player.pause();
      }
    });
    return () => sub.remove();
  }, [player]);

  if (failed) return null;

  return (
    <VideoView
      style={StyleSheet.absoluteFill}
      player={player}
      contentFit="cover"
      nativeControls={false}
      // Overlapping views on Android can be drawn under a SurfaceView; the
      // texture surface guarantees the header/copy layer on top of the video.
      surfaceType="textureView"
    />
  );
}

/**
 * The Food hero: a full-bleed video/image background (the active
 * `food_home_hero` banner) with the shared header — logo, delivery location,
 * module switcher, search, cart, notifications, profile — layered on top. The
 * banner's own headline, offer text and CTA are dynamic and tappable.
 *
 * Mirrors customer-web's `FoodHero`; the header is rendered here (not by
 * `Screen`) so there is exactly one header in view. The search + Veg Mode row
 * belongs to the hero: it is passed in as `searchSlot` and rendered between the
 * shared header and the banner copy, so it scrolls away with the hero.
 * `footerSlot` renders at the hero's lower edge (the reference's overlapping
 * promotional tiles), also scrolling with it.
 */
export function FoodHero({
  banners,
  searchSlot,
  footerSlot,
}: {
  banners: Banner[];
  searchSlot?: ReactNode;
  footerSlot?: ReactNode;
}) {
  const router = useRouter();
  const banner = banners[0];

  const videoUri =
    banner?.media_type === 'video' && banner.video ? imageUrl(banner.video) : '';
  const posterUri = banner ? imageUrl(banner.poster_image ?? banner.image) : '';

  return (
    <View style={styles.hero}>
      <View style={styles.mediaLayer}>
        {/* Poster / image sits behind the video so it also serves as the
            fallback when playback fails or no video is configured. */}
        {posterUri ? (
          <ProductImage src={banner?.poster_image ?? banner?.image ?? null} style={styles.media} rounded={false} />
        ) : videoUri ? null : (
          <LinearGradient colors={HERO_THEMES.food.headerBg} style={StyleSheet.absoluteFill} />
        )}

        {/* Readability scrim for the image / gradient fallback only. It paints
            *under* the video — the web reference lifts the video above it with
            `z-index: 1` — so a playing video is never darkened or graded and
            the copy still sits on a scrim when no video is available. */}
        <LinearGradient colors={SCRIM} style={StyleSheet.absoluteFill} />

        {videoUri ? <HeroVideo uri={videoUri} /> : null}
      </View>

      {/* Explicit stacking (RN `zIndex`, not CSS): media below, every hero
          control above the video. */}
      <View style={styles.content}>
        <AppHeader variant="overlay" />

        {/* The Food search + Veg Mode control sits inside the hero, directly
            under the header, as in the reference. */}
        {searchSlot ?? null}

        <View style={styles.spacer} />

        {banner ? (
          <Pressable
            onPress={() => router.push(bannerRoute(banner) as never)}
            style={({ pressed }) => [styles.copy, pressed && { opacity: 0.94 }]}
            accessibilityLabel={banner.title}
          >
            <Text style={styles.title} numberOfLines={2}>
              {/* {banner.title} */}
            </Text>
            {banner.subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {banner.subtitle}
              </Text>
            ) : null}
            {banner.cta_text ? (
              <View style={styles.cta}>
                <Text style={styles.ctaText}>{banner.cta_text}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}

        {footerSlot ?? null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: HERO_MIN_HEIGHT,
    backgroundColor: colors.food[900],
    overflow: 'hidden',
  },
  mediaLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  media: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    minHeight: HERO_MIN_HEIGHT,
    justifyContent: 'space-between',
    paddingBottom: 20,
    zIndex: 1,
  },
  spacer: {
    flex: 1,
  },
  copy: {
    paddingHorizontal: 16,
    maxWidth: 520,
  },
  cta: {
    /* The web hero shrink-wraps the pill's button to the pill and centres it
       with `justify-items-center`; `alignSelf` is RN's equivalent here. The
       rest of the copy stays left-aligned. */
    alignSelf: 'center',
    marginBottom: 5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.food[1000],
  },
  ctaText: {
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
    fontSize: 30,
    lineHeight: 34,
  },
  subtitle: {
    fontFamily: 'Outfit_400Regular',
    marginTop: 6,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 19,
  },
});
