import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/app/layouts/AppShell';
import { foodRoutes } from './food.routes';
import { groceryRoutes } from './grocery.routes';
import { ridesRoutes } from './rides.routes';
import { sharedRoutes } from './shared.routes';
import { authRoutes } from './auth.routes';

/**
 * Route composition root.
 *
 * URL contracts are intentionally unchanged from the pre-refactor app. Each
 * module contributes its own route group, so ownership is visible from the
 * filesystem and a module can be removed or lazy-loaded without touching the
 * others.
 *
 * Route groups are element constants (fragments), not components: React Router
 * only accepts <Route> or <Fragment> children inside <Routes>.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/food" replace />} />
        {foodRoutes}
        {groceryRoutes}
        {ridesRoutes}
        {sharedRoutes}
        {authRoutes}
        <Route path="*" element={<Navigate to="/food" replace />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
