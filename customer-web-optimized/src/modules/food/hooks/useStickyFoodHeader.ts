import { useEffect, useRef, useState } from 'react';

/**
 * Zomato-style two-stage sticky header state for the Food home page.
 *
 * Stage A pins the compact search + Veg Mode row the moment the hero's own
 * search scrolls up to the viewport top; Stage B pins the category row
 * directly beneath it once the categories reach the pinned search row. Both
 * activation points come from the rows' measured viewport positions and the
 * measured sticky-row height — no hardcoded offsets.
 *
 * Extracted from `food.tsx` without changing any measurement or threshold.
 */
export function useStickyFoodHeader() {
  const heroSearchRef = useRef<HTMLDivElement | null>(null);
  const categoriesRef = useRef<HTMLDivElement | null>(null);
  const stickySearchRef = useRef<HTMLDivElement | null>(null);
  const [stickySearchH, setStickySearchH] = useState(0);
  const [searchStuck, setSearchStuck] = useState(false);
  const [catStuck, setCatStuck] = useState(false);

  // The pinned search row is `position: fixed` and out of flow, so its height
  // cannot shift the page; measuring it lets the categories dock exactly
  // beneath it and release at the correct scroll position on the way back up.
  useEffect(() => {
    const el = stickySearchRef.current;
    if (!el) return;
    const measure = () => setStickySearchH(el.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const search = heroSearchRef.current;
      const cats = categoriesRef.current;
      const bar = stickySearchRef.current;
      const barH = bar ? bar.getBoundingClientRect().height : 0;
      const searchTop = search ? search.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
      const catTop = cats ? cats.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
      // Stage A: the hero search has scrolled up to the viewport top.
      setSearchStuck(searchTop <= 0.5);
      // Stage B: the category row has reached the bottom edge of the pinned
      // search row (its measured height is the dock offset).
      setCatStuck(barH > 0 && catTop <= barH + 0.5);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return {
    heroSearchRef,
    categoriesRef,
    stickySearchRef,
    stickySearchH,
    searchStuck,
    catStuck,
  };
}
