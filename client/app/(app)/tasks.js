import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getTasks, saveSelectedTasks } from '../../src/api/tasks';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { StateCard } from '../../src/components/StateCard';
import { useAuth } from '../../src/state/auth';
import { colors, radius, spacing } from '../../src/theme';

const categories = ['All', 'Errands & Daily Tasks', 'Home Services', 'Travel & Tourism', 'Health & Medical', 'Senior Care', 'Events & Management'];

export default function Tasks() {
  const { selectedTasks, updateTasks } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(new Set(selectedTasks.map((task) => task.id)));
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getTasks({ search, category: category === 'All' ? undefined : category });
      setTasks(result || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [search, category]);

  const selectedItems = useMemo(() => [...selected]
    .map((id) => tasks.find((task) => task.id === id) || selectedTasks.find((task) => task.id === id))
    .filter(Boolean), [tasks, selected, selectedTasks]);

  const groupedTasks = useMemo(() => {
    const groups = new Map();
    for (const task of tasks) {
      if (!groups.has(task.category)) groups.set(task.category, []);
      groups.get(task.category).push(task);
    }
    return [...groups.entries()];
  }, [tasks]);

  const toggle = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = async () => {
    if (!selected.size) return;
    setSaving(true);
    setError('');
    try {
      const saved = await saveSelectedTasks([...selected]);
      updateTasks(saved || []);
      router.replace('/(app)/home');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  if (review) {
    return (
      <Screen contentStyle={styles.content}>
        <Pressable onPress={() => setReview(false)} accessibilityRole="button" accessibilityLabel="Back to task list" hitSlop={10}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.eyebrow}>REVIEW</Text>
        <Text style={styles.title}>This is what you want handled.</Text>
        <Text style={styles.copy}>{selected.size} selection{selected.size === 1 ? '' : 's'}. You can change this later.</Text>
        <View style={styles.reviewList}>
          {selectedItems.map((task) => (
            <View key={task.id} style={styles.reviewItem}>
              <Text style={styles.reviewName}>{task.name}</Text>
              <Text style={styles.reviewCategory}>{task.category}</Text>
            </View>
          ))}
        </View>
        {error ? <StateCard title="Could not save" message={error} actionLabel="Try again" onAction={confirm} /> : null}
        <Button label="Confirm selections" onPress={confirm} loading={saving} testID="tasks-confirm" />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <Text style={styles.eyebrow}>MAKE IT YOURS</Text>
      <Text style={styles.title}>What should your Padosi handle?</Text>
      <Text style={styles.copy}>Pick the things you would rather not coordinate yourself.</Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search tasks"
        placeholderTextColor={colors.muted}
        style={styles.search}
        accessibilityLabel="Search tasks"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.chips}
        accessibilityLabel="Task categories"
      >
        {categories.map((item) => (
          <Pressable
            key={item}
            onPress={() => setCategory(item)}
            accessibilityRole="button"
            accessibilityState={{ selected: category === item }}
            style={[styles.chip, category === item && styles.chipActive]}
          >
            <Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.muted}>Loading tasks…</Text></View> : null}
      {!loading && error ? <StateCard title="Could not load tasks" message={error} actionLabel="Retry" onAction={load} /> : null}
      {!loading && !error && !tasks.length ? <StateCard title="No matching tasks" message="Try a different search or category." /> : null}

      <View style={styles.list}>
        {!loading && !error && groupedTasks.map(([group, groupTasks]) => (
          <View key={group} style={styles.group}>
            <Text style={styles.groupTitle}>{group}</Text>
            {groupTasks.map((task) => {
              const active = selected.has(task.id);
              return (
                <Pressable
                  key={task.id}
                  onPress={() => toggle(task.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`${task.name}, ${task.category}`}
                  testID={`task-${task.id}`}
                  style={[styles.task, active && styles.taskActive]}
                >
                  <View style={styles.taskHead}>
                    <Text style={styles.taskName}>{task.name}</Text>
                    <View style={[styles.check, active && styles.checkActive]}><Text style={styles.checkText}>{active ? '✓' : ''}</Text></View>
                  </View>
                  <Text style={styles.taskDescription}>{task.description}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.count}>{selected.size} selected</Text>
        <Button label="Review" onPress={() => setReview(true)} disabled={!selected.size} testID="tasks-review" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: 36 },
  back: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 40, fontWeight: '900' },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  search: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 14, color: colors.ink, fontSize: 16 },
  categoryScroll: { height: 44, flexGrow: 0 },
  chips: { gap: 8, alignItems: 'center' },
  chip: { height: 44, flexShrink: 0, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '700', flexShrink: 0 },
  chipTextActive: { color: colors.white },
  loading: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  muted: { color: colors.muted },
  list: { gap: spacing.lg },
  group: { gap: spacing.sm },
  groupTitle: { color: colors.ink, fontSize: 18, lineHeight: 22, fontWeight: '900' },
  task: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md, gap: 6 },
  taskActive: { borderColor: colors.accent, backgroundColor: '#FFF7F2' },
  taskHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  taskName: { flex: 1, color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  taskCategory: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  taskDescription: { color: colors.muted, lineHeight: 19, fontSize: 14 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkText: { color: colors.white, fontWeight: '900' },
  footer: { marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.ink, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  count: { color: colors.white, fontWeight: '800', paddingLeft: spacing.sm },
  reviewList: { gap: spacing.sm },
  reviewItem: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md },
  reviewName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  reviewCategory: { color: colors.accent, marginTop: 4, fontSize: 12, fontWeight: '800' }
});
