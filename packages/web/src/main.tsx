import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { AppStateProvider } from './hooks/useAppState';
import { api } from './api/client';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 2000 },
  },
});

window.addEventListener('error', (event) => {
  void api.reportClientError({
    message: event.message,
    stack: event.error?.stack ?? null,
    component: 'window',
    url: window.location.href,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  void api.reportClientError({
    message: `unhandled rejection: ${String(event.reason)}`,
    stack: event.reason?.stack ?? null,
    component: 'window',
    url: window.location.href,
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
