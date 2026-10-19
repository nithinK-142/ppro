import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getMe } from '../api/profile';
import { ApiError, subscribeToAuthExpiry } from '../api/client';
import { login as loginRequest, logout as logoutRequest } from '../api/auth';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../storage/token';
import type { AuthStatus, LoginResponse, Profile, SessionData, Task, User } from '../types';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  profile: Profile | null;
  selectedTasks: Task[];
  signIn: (email: string, password: string) => Promise<void>;
  completeSignIn: (data: LoginResponse) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (nextProfile: Profile) => void;
  updateTasks: (tasks: Task[]) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);

  function applySession(data: Pick<SessionData, 'user' | 'profile' | 'selectedTasks'>) {
    setUser(data.user);
    setProfile(data.profile);
    setSelectedTasks(data.selectedTasks);
    setStatus('signed_in');
  }

  function clearSession() {
    setUser(null);
    setProfile(null);
    setSelectedTasks([]);
    setStatus('signed_out');
  }

  async function refresh() {
    try {
      const token = await getAccessToken();
      const refreshToken = token ? null : await getRefreshToken();
      if (!token && !refreshToken) {
        setStatus('signed_out');
        return;
      }

      applySession(await getMe());
    } catch (error: unknown) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        try {
          await clearTokens();
        } finally {
          clearSession();
        }
        return;
      }

      setStatus('session_error');
    }
  }

  useEffect(() => {
    const unsubscribe = subscribeToAuthExpiry(() => clearSession());
    void refresh();
    return unsubscribe;
  }, []);

  async function completeSignIn(data: LoginResponse) {
    await setTokens(data.accessToken, data.refreshToken);
    applySession(data);
  }

  async function signIn(email: string, password: string) {
    await completeSignIn(await loginRequest({ email, password }));
  }

  async function signOut() {
    try {
      const refreshToken = await getRefreshToken();
      if (refreshToken) await logoutRequest(refreshToken);
    } catch {
      // Local sign-out must still complete when the API is unreachable.
    } finally {
      try {
        await clearTokens();
      } finally {
        clearSession();
      }
    }
  }

  function updateProfile(nextProfile: Profile) {
    setProfile(nextProfile);
  }

  function updateTasks(tasks: Task[]) {
    setSelectedTasks(tasks);
  }

  return (
    <AuthContext.Provider value={{
      status,
      user,
      profile,
      selectedTasks,
      signIn,
      completeSignIn,
      signOut,
      refresh,
      updateProfile,
      updateTasks
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
