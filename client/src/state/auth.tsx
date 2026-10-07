import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getMe } from '../api/profile';
import { ApiError } from '../api/client';
import { login as loginRequest } from '../api/auth';
import { clearToken, getToken, setToken } from '../storage/token';
import type { AuthStatus, Profile, SessionData, Task, User } from '../types';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  profile: Profile | null;
  selectedTasks: Task[];
  signIn: (email: string, password: string) => Promise<void>;
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
    const token = await getToken();
    if (!token) {
      setStatus('signed_out');
      return;
    }

    try {
      applySession(await getMe());
    } catch (error: unknown) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await clearToken();
        clearSession();
        return;
      }

      setStatus('session_error');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function signIn(email: string, password: string) {
    const data = await loginRequest({ email, password });
    await setToken(data.token);
    applySession(data);
  }

  async function signOut() {
    await clearToken();
    clearSession();
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
