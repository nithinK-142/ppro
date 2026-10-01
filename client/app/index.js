import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StateCard } from '../src/components/StateCard';
import { useAuth } from '../src/state/auth';
import { colors } from '../src/theme';

export default function Index() {
  const { status, profile, selectedTasks, refresh } = useAuth();

  if (status === 'loading') {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  if (status === 'session_error') {
    return (
      <View style={styles.center}>
        <StateCard
          title="Connection problem"
          message="We couldn't restore your session. Your login is still saved."
          actionLabel="Try again"
          onAction={refresh}
        />
      </View>
    );
  }

  if (status === 'signed_out') return <Redirect href="/(auth)/login" />;
  if (!profile) return <Redirect href="/(onboarding)/profile" />;
  if (!selectedTasks.length) return <Redirect href="/(app)/tasks" />;
  return <Redirect href="/(app)/home" />;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } });
