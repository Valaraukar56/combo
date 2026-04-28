import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { AppShell } from './App';
import { AuthProvider } from './lib/auth';
import { GameProvider } from './lib/game';
import { ToastProvider } from './components/Toast';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <GameProvider>
          <AppShell />
        </GameProvider>
      </AuthProvider>
    </ToastProvider>
  </StrictMode>
);
