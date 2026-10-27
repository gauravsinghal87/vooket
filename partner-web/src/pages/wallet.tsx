import { Navigate } from 'react-router-dom';

/**
 * The Partner wallet is no longer a separate module: it is the Transactions tab
 * of the unified earnings dashboard. Old bookmarks and links are redirected to
 * the canonical page rather than 404ing, so the ledger stays reachable.
 */
export function WalletPage() {
  return <Navigate to="/earnings?tab=overview" replace />;
}
