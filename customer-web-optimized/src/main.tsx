import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppRoutes from '@/app/routes/AppRoutes';
import { AppProviders } from '@/app/providers/app-providers';
import './index.css';

const rootEl = document.getElementById('root')!;

createRoot(rootEl).render(
  <StrictMode>
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  </StrictMode>
);
