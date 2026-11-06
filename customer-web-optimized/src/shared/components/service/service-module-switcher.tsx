import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/shared/stores/appStore';
import { SERVICE_THEMES, SERVICE_ROUTES, activeService } from './service-theme';
import { cn } from '@/shared/utils/utils';
import type { ServiceType } from '@/shared/types/models';

interface ServiceModuleSwitcherProps {
  activeService?: ServiceType | null;
  className?: string;
  /** Warm the destination module chunk on pointer/focus intent. */
  onModuleIntent?: (value: ServiceType) => void;
}

export function ServiceModuleSwitcher({
  activeService: activeProp,
  className,
  onModuleIntent,
}: ServiceModuleSwitcherProps) {
  const navigate = useNavigate();
  // `search` resolves the shared screens (/cart, /checkout, /search) and
  // `state.type` the product page (its links pass the module via router state),
  // so the owning module stays lit on every one of its screens.
  const { pathname, search, state } = useLocation();
  const setService = useAppStore((s) => s.setService);
  const storedService = useAppStore((s) => s.service);
  // `/orders` belongs to no single service: it is scoped by the switcher's own
  // selection, so the chosen tab stays lit there and picking a module reloads
  // the history list in place instead of navigating to that module's home.
  const routeService = activeService(pathname, search, (state as { type?: string } | null)?.type);
  const isHistoryScreen = pathname === '/orders';

  const active =
    activeProp !== undefined ? activeProp : routeService ?? (isHistoryScreen ? storedService : null);

  const go = (value: ServiceType) => {
    setService(value);
    if (pathname === SERVICE_ROUTES[value]) return;
    if (isHistoryScreen) return;
    navigate(SERVICE_ROUTES[value]);
  };

  return (
    <nav aria-label="Services" className={cn('module-glass', className)} role="tablist">
      <div className="module-glass-inner">
        {(Object.keys(SERVICE_THEMES) as ServiceType[]).map((value) => {
          const theme = SERVICE_THEMES[value];
          const Icon = theme.icon;
          const isActive = active === value;

          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Open ${theme.label}`}
              className={cn('module-glass-tab', isActive ? 'is-active' : 'is-inactive')}
              onClick={() => go(value)}
              onPointerEnter={() => onModuleIntent?.(value)}
              onFocus={() => onModuleIntent?.(value)}
            >
              <span className="module-glass-tab-content">
                <Icon className="module-glass-icon" strokeWidth={2.1} />
                <span className="module-glass-label">{theme.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}