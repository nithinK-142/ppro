import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe } from '../api/profile';
import { login as loginRequest } from '../api/auth';
import { clearToken, getToken, setToken } from '../storage/token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setStatus('signed_out');
      return;
    }

    try {
      const data = await getMe();
      setUser(data.user);
      setProfile(data.profile);
      setSelectedTasks(data.selectedTasks);
      setStatus('signed_in');
    } catch {
      await clearToken();
      setUser(null);
      setProfile(null);
      setSelectedTasks([]);
      setStatus('signed_out');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(async (email, password) => {
    const data = await loginRequest({ email, password });
    await setToken(data.token);
    await refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
    setProfile(null);
    setSelectedTasks([]);
    setStatus('signed_out');
  }, []);

  const updateProfile = useCallback((nextProfile) => setProfile(nextProfile), []);
  const updateTasks = useCallback((tasks) => setSelectedTasks(tasks), []);

  const value = useMemo(() => ({
    status,
    user,
    profile,
    selectedTasks,
    signIn,
    signOut,
    refresh,
    updateProfile,
    updateTasks
  }), [status, user, profile, selectedTasks, signIn, signOut, refresh, updateProfile, updateTasks]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
