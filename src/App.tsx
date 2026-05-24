import { useEffect, useState } from 'react';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';
import { AuthPage } from './components/AuthPage';
import { FullPageLoader } from './components/ui/FullPageLoader';
import { ConfigBanner } from './components/ui/ConfigBanner';
import { useAuth } from './lib/AuthContext';
import {
  bulkAppendChat,
  mergeScheduleIntoAccount,
} from './lib/firestore';
import {
  clearGuestData,
  getGuestChat,
  getGuestSchedule,
  getGuestWorkspaces,
  addGuestWorkspace,
  setGuestActiveWorkspaceId,
  getGuestActiveWorkspaceId,
  setGuestSkill,
} from './lib/localStore';
import { WORKSPACE_COLORS, genWorkspaceId } from './types';
import { useToast } from './lib/toast';

type Route = 'onboarding' | 'auth' | 'dashboard';

export default function App() {
  const { user, loading, configured } = useAuth();
  const toast = useToast();
  const [route, setRoute] = useState<Route>('onboarding');

  // On boot, decide where to send the user.
  useEffect(() => {
    if (loading) return;
    if (user) {
      setRoute('dashboard');
    } else if (getGuestWorkspaces().length > 0) {
      // Returning guest who already has workspaces
      setRoute('dashboard');
    } else {
      setRoute((r) => (r === 'auth' ? 'auth' : 'onboarding'));
    }
  }, [user, loading]);

  // On sign-in, migrate guest data into Firestore. Workspace creation/migration
  // is handled inside useWorkspaces on first load.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const guestSchedule = getGuestSchedule();
        const guestChat = getGuestChat();
        const hadLocal = getGuestWorkspaces().length > 0;
        try {
          await mergeScheduleIntoAccount(user.uid, guestSchedule);
          await bulkAppendChat(user.uid, guestChat);
          if (hadLocal) {
            clearGuestData();
            if (!cancelled) toast.success('Your local progress was synced to your account.');
          }
        } catch (err) {
          console.error('guest data migration failed', err);
          if (hadLocal && !cancelled) {
            toast.error('Could not sync local data — it is still saved on this device.');
          }
        }
      } catch (err) {
        console.error('profile load failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user, toast]);

  /** Called from Onboarding when the user picks a skill and continues as guest. */
  const beginAsGuest = (initialSkill: string) => {
    // Create the first workspace for this guest
    const wss = getGuestWorkspaces();
    if (wss.length === 0) {
      const ws = {
        id: genWorkspaceId(),
        name: initialSkill.trim() || 'My Workspace',
        createdAt: Date.now(),
        color: WORKSPACE_COLORS[0],
      };
      addGuestWorkspace(ws);
      setGuestActiveWorkspaceId(ws.id);
      setGuestSkill(ws.name);
    }
    setRoute('dashboard');
  };

  if (loading) return <FullPageLoader label="Loading SkillPath…" />;

  return (
    <>
      {!configured && <ConfigBanner />}

      {route === 'auth' && (
        <AuthPage
          onBack={() => setRoute(user ? 'dashboard' : (getGuestWorkspaces().length > 0 ? 'dashboard' : 'onboarding'))}
          onAuthenticated={() => setRoute('dashboard')}
        />
      )}

      {route === 'onboarding' && !user && (
        <Onboarding
          onComplete={beginAsGuest}
          onSignIn={() => setRoute('auth')}
        />
      )}

      {route === 'dashboard' && (
        <Dashboard onRequestAuth={() => setRoute('auth')} />
      )}
    </>
  );
}
