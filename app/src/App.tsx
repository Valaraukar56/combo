import { useEffect, useState } from 'react';
import { DevNav } from './components/DevNav';
import { useAuth } from './lib/auth';
import { useGame } from './lib/game';
import { HomeScreen, LoginScreen, RegisterScreen } from './screens/auth';
import { LobbyScreen, WaitingRoomScreen } from './screens/lobby';
import {
  GameTableScreen,
  MemorizeScreen,
  PowerScreen,
  SnapResolutionScreen,
} from './screens/game';
import { EndGameScreen, EndRoundScreen } from './screens/end';
import {
  HistoryScreen,
  LeaderboardScreen,
  ProfileScreen,
  RulesScreen,
  SettingsScreen,
} from './screens/meta';
import type { Page } from './types';

const PUBLIC_PAGES: Page[] = ['home', 'login', 'register'];
const META_PAGES: Page[] = ['lobby', 'rules', 'leaderboard', 'history', 'profile', 'settings'];

export function AppShell() {
  const { user, hydrated } = useAuth();
  const { roomState, lastSnap, clearSnap } = useGame();
  const [page, setPage] = useState<Page>('home');
  const [showSnap, setShowSnap] = useState(false);

  // Once authenticated, default to lobby (unless user navigated elsewhere)
  useEffect(() => {
    if (user && PUBLIC_PAGES.includes(page)) {
      setPage('lobby');
    }
  }, [user, page]);

  // If anonymous, kick out of any non-public page
  useEffect(() => {
    if (hydrated && !user && !PUBLIC_PAGES.includes(page)) {
      setPage('home');
    }
  }, [hydrated, user, page]);

  // Show a brief snap-resolution overlay when a snap event arrives
  useEffect(() => {
    if (!lastSnap) {
      setShowSnap(false);
      return;
    }
    setShowSnap(true);
    const t = setTimeout(() => {
      setShowSnap(false);
      clearSnap();
    }, 2200);
    return () => clearTimeout(t);
  }, [lastSnap, clearSnap]);

  if (!hydrated) return null;

  // Anonymous routes
  if (!user) {
    switch (page) {
      case 'login':
        return <LoginScreen onNavigate={setPage} />;
      case 'register':
        return <RegisterScreen onNavigate={setPage} />;
      case 'home':
      default:
        return <HomeScreen onNavigate={setPage} />;
    }
  }

  // Authenticated — if in a room, route by phase
  if (roomState) {
    const inner = (() => {
      switch (roomState.phase) {
        case 'waiting':
          return <WaitingRoomScreen />;
        case 'memorize':
          return <MemorizeScreen />;
        case 'power':
          return <PowerScreen />;
        case 'round-end':
          return <EndRoundScreen />;
        case 'game-end':
          return <EndGameScreen onBackLobby={() => setPage('lobby')} />;
        case 'turn':
        case 'snap-window':
        case 'combo-final':
        default:
          return <GameTableScreen />;
      }
    })();
    return (
      <>
        {inner}
        {showSnap && <SnapResolutionScreen />}
        {user.isAdmin && <DevNav onJump={setPage} />}
      </>
    );
  }

  // Authenticated and not in a room: meta pages
  const metaInner = (() => {
    switch (page) {
      case 'rules':
        return <RulesScreen onNavigate={setPage} />;
      case 'leaderboard':
        return <LeaderboardScreen onNavigate={setPage} />;
      case 'history':
        return <HistoryScreen onNavigate={setPage} />;
      case 'profile':
        return <ProfileScreen onNavigate={setPage} />;
      case 'settings':
        return <SettingsScreen onNavigate={setPage} />;
      case 'lobby':
      default:
        return <LobbyScreen onNavigate={setPage} />;
    }
  })();
  return (
    <>
      {metaInner}
      {user.isAdmin && <DevNav onJump={setPage} />}
    </>
  );
}

export { META_PAGES };
