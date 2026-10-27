import { ServiceModuleSwitcher } from '@/components/service/service-module-switcher';

/**
 * The bar fixed to the bottom of every screen: the Food / Grocery / Rides
 * module switcher.
 *
 * This slot used to hold the five-item page nav (Home / Orders / Rides /
 * Wallet / You). The app is organised by module, so what belongs at the bottom
 * is the control that moves between modules — the page links now live in the
 * header's account menu and on the Profile page.
 *
 * The dock is a full-width frosted-glass band (white + backdrop-blur) rather
 * than the solid black plate it was, and the switcher stretches the whole
 * width of the viewport inside an 8px inset — no centred max-width pill with
 * black showing around it. Unlike the old nav it is not `md:hidden`: the
 * header no longer renders a second switcher, so this is the only one on any
 * viewport. Its height is pinned to `--bottom-dock-h`, which `AppShell` and
 * every fixed action bar below use to keep flush with its top edge.
 */
export function BottomNav() {
  return (
    <nav
      aria-label="Services"
      className="fixed inset-x-0 bottom-0 z-40 min-h-[var(--bottom-dock-h)] border-t border-ink-100/80 bg-white/60 pb-safe backdrop-blur-2xl"
    >
      <div className="w-full p-2">
        <ServiceModuleSwitcher />
      </div>
    </nav>
  );
}
