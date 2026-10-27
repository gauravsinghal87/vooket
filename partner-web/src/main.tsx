import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { Toaster } from '@/components/ui/toast';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import './index.css';

window.addEventListener('auth:unauthorized', () => {
  void useAuthStore.getState().logout();
});

void useAuthStore.getState().initialize();

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);