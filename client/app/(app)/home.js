import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getSelectedTasks } from '../../src/api/tasks';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { StateCard } from '../../src/components/StateCard';
import { useAuth } from '../../src/state/auth';
import { colors, radius, spacing } from '../../src/theme';

export default function Home() {
  const { user, selectedTasks, updateTasks, signOut } = useAuth();

  const logout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };
  const [tasks, setTasks] = useState(selectedTasks);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSelectedTasks();
      setTasks(data || []);
      updateTasks(data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [updateTasks]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.top}>
        <View>
          <Text style={styles.eyebrow}>YOUR PADOSI</Text>
          <Text style={styles.title}>A little less to carry.</Text>
        </View>
        <Pressable onPress={logout} accessibilityRole="button" accessibilityLabel="Log out" testID="logout">
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>You picked what matters.</Text>
        <Text style={styles.noteCopy}>These are the tasks you want handled. Your Lifestyle Manager can take them from here.</Text>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.muted}>Loading your list…</Text></View> : null}
      {!loading && error ? <StateCard title="Could not load your list" message={error} actionLabel="Retry" onAction={load} /> : null}
      {!loading && !error && !tasks.length ? <StateCard title="Your list is empty" message="Pick a few tasks and come back here when you are ready." actionLabel="Choose tasks" onAction={() => router.push('/(app)/tasks')} /> : null}

      {!loading && !error && tasks.length ? (
        <View style={styles.list}>
          {tasks.map((task) => (
            <View key={task.id} style={styles.task}>
              <View style={styles.taskDot} />
              <View style={styles.taskCopy}>
                <Text style={styles.taskName}>{task.name}</Text>
                <Text style={styles.taskMeta}>{task.category}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Button label="Change my tasks" onPress={() => router.push('/(app)/tasks')} secondary />
      <Text style={styles.footer}>Signed in as {user?.email}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: 34 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.lg },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 40, fontWeight: '900', maxWidth: 300, marginTop: 5 },
  logout: { color: colors.ink, fontWeight: '800', fontSize: 13, paddingVertical: 8 },
  note: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  noteTitle: { color: colors.white, fontSize: 21, fontWeight: '900' },
  noteCopy: { color: '#DCD9D0', lineHeight: 21 },
  loading: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  muted: { color: colors.muted },
  list: { gap: spacing.sm },
  task: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  taskDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent, marginTop: 6 },
  taskCopy: { flex: 1, gap: 3 },
  taskName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  taskMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  footer: { color: colors.muted, fontSize: 12, textAlign: 'center' }
});
