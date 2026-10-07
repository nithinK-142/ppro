import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccountMenu } from '../../src/components/AccountMenu';
import { Button } from '../../src/components/Button';
import { ProfileIcon } from '../../src/components/ProfileIcon';
import { Screen } from '../../src/components/Screen';
import { StateCard } from '../../src/components/StateCard';
import { useAuth } from '../../src/state/auth';
import { colors, radius, spacing } from '../../src/theme';
import type { Task } from '../../src/types';

const HOW_IT_WORKS = [
  ['Tell us', 'Share what needs handling.'],
  ['Match', 'Your Lifestyle Manager coordinates the right provider.'],
  ['Track', 'Get updates while it is being handled.'],
  ['Done', 'Review the result and move on.']
];

export default function Home() {
  const { user, profile, selectedTasks, signOut } = useAuth();
  const tasks = selectedTasks;
  const [menuVisible, setMenuVisible] = useState(false);

  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const categoryTasks = groups.get(task.category);
    if (categoryTasks) categoryTasks.push(task);
    else groups.set(task.category, [task]);
  }
  const groupedTasks = [...groups.entries()];

  const categoryCount = groupedTasks.length;
  const firstName = profile?.name?.trim().split(/\s+/)[0] || 'there';

  const logout = async () => {
    setMenuVisible(false);
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.top}>
        <View style={styles.greeting}>
          <Text style={styles.eyebrow}>YOUR PADOSI</Text>
          <Text style={styles.title}>Good to have you back, {firstName}.</Text>
        </View>
        <Pressable
          onPress={() => setMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Open account menu"
          testID="account-menu"
          hitSlop={8}
        >
          <ProfileIcon />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>ONE POINT OF CONTACT</Text>
          <Text style={styles.heroTitle}>Less chasing. More done.</Text>
          <Text style={styles.heroText}>
            Your Lifestyle Manager handles the coordination behind the services you picked.
          </Text>
        </View>
        <View style={styles.heroMetric}>
          <Text style={styles.heroNumber}>{tasks.length}</Text>
          <Text style={styles.heroLabel}>services</Text>
        </View>
      </View>

      {!tasks.length ? (
        <StateCard
          title="Your service list is empty"
          message="Choose the things you would rather not coordinate yourself."
          actionLabel="Choose services"
          onAction={() => router.push('/(app)/tasks')}
        />
      ) : null}

      {tasks.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>YOUR SERVICES</Text>
              <Text style={styles.sectionTitle}>What you want handled</Text>
            </View>
            <Text style={styles.sectionCount}>{categoryCount} {categoryCount === 1 ? 'category' : 'categories'}</Text>
          </View>

          <View style={styles.serviceList}>
            {groupedTasks.map(([category, categoryTasks]) => (
              <View key={category} style={styles.serviceGroup}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName}>{category}</Text>
                  <Text style={styles.categoryCount}>{categoryTasks.length}</Text>
                </View>
                {categoryTasks.map((task) => (
                  <View key={task.id} style={styles.task}>
                    <View style={styles.taskMark}><Text style={styles.taskMarkText}>✓</Text></View>
                    <View style={styles.taskCopy}>
                      <Text style={styles.taskName}>{task.name}</Text>
                      <Text style={styles.taskDescription}>{task.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.householdCard}>
        <Text style={styles.cardEyebrow}>HOUSEHOLD</Text>
        <Text style={styles.cardTitle}>{profile?.name || 'Your household'}</Text>
        <Text style={styles.cardValue}>{profile?.address}</Text>
        {profile?.businessName ? <Text style={styles.cardMuted}>{profile.businessName}</Text> : null}
        <Pressable
          onPress={() => router.push('/(app)/profile')}
          accessibilityRole="button"
          accessibilityLabel="View profile"
          style={({ pressed }) => [styles.linkButton, pressed && styles.linkPressed]}
        >
          <Text style={styles.linkText}>View profile</Text>
          <Text style={styles.linkArrow}>→</Text>
        </Pressable>
      </View>

      <View style={styles.howCard}>
        <Text style={styles.cardEyebrow}>HOW IT WORKS</Text>
        <Text style={styles.cardTitle}>One workflow. Less coordination.</Text>
        <View style={styles.steps}>
          {HOW_IT_WORKS.map(([title, copy], index) => (
            <View key={title} style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{String(index + 1).padStart(2, '0')}</Text></View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepTitle}>{title}</Text>
                <Text style={styles.stepText}>{copy}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.nextCard}>
        <Text style={styles.nextEyebrow}>READY WHEN YOU ARE</Text>
        <Text style={styles.nextTitle}>Need to change your list?</Text>
        <Text style={styles.nextText}>Add services or remove anything you no longer need handled.</Text>
        <Button label="Change services" onPress={() => router.push('/(app)/tasks')} />
      </View>

      <Text style={styles.footer}>Signed in as {user?.email}</Text>

      <AccountMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onProfile={() => {
          setMenuVisible(false);
          router.push('/(app)/profile');
        }}
        onLogout={logout}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: 24 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  greeting: { flex: 1, gap: 5, paddingTop: 6 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 31, lineHeight: 37, fontWeight: '900', maxWidth: 325 },
  hero: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.lg },
  heroCopy: { flex: 1, gap: spacing.sm },
  heroEyebrow: { color: '#DCD9D0', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: { color: colors.white, fontSize: 24, lineHeight: 29, fontWeight: '900' },
  heroText: { color: '#DCD9D0', fontSize: 14, lineHeight: 20 },
  heroMetric: { width: 74, alignItems: 'flex-end', paddingBottom: 2 },
  heroNumber: { color: colors.white, fontSize: 32, lineHeight: 34, fontWeight: '900' },
  heroLabel: { color: '#DCD9D0', fontSize: 12, fontWeight: '700', marginTop: 2 },
  muted: { color: colors.muted },
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  sectionEyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  sectionTitle: { color: colors.ink, fontSize: 22, lineHeight: 27, fontWeight: '900', marginTop: 3 },
  sectionCount: { color: colors.muted, fontSize: 12, fontWeight: '700', paddingBottom: 2 },
  serviceList: { gap: spacing.md },
  serviceGroup: { gap: spacing.sm },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  categoryName: { color: colors.ink, fontSize: 16, fontWeight: '900', flex: 1 },
  categoryCount: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  task: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  taskMark: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  taskMarkText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  taskCopy: { flex: 1, gap: 3 },
  taskName: { color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  taskDescription: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  householdCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardEyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  cardTitle: { color: colors.ink, fontSize: 20, lineHeight: 25, fontWeight: '900' },
  cardValue: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  cardMuted: { color: colors.muted, fontSize: 13 },
  linkButton: { alignSelf: 'flex-start', marginTop: 2, borderRadius: radius.pill, backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkPressed: { opacity: 0.85 },
  linkText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  linkArrow: { color: colors.white, fontSize: 16, lineHeight: 16 },
  howCard: { backgroundColor: '#ECE7DC', borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  steps: { gap: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', paddingVertical: 4 },
  stepNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  stepNumberText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  stepCopy: { flex: 1, gap: 2, paddingTop: 2 },
  stepTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  stepText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  nextCard: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  nextEyebrow: { color: '#DCD9D0', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  nextTitle: { color: colors.white, fontSize: 21, lineHeight: 26, fontWeight: '900' },
  nextText: { color: '#DCD9D0', fontSize: 14, lineHeight: 20, marginBottom: 4 },
  footer: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingBottom: 8 }
});
