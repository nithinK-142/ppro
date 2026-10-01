import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/state/auth';
import { colors, radius, spacing } from '../../src/theme';

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'Not provided'}</Text>
    </View>
  );
}

export default function Profile() {
  const { user, profile } = useAuth();

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <Button label="Back" onPress={() => router.back()} secondary testID="profile-back" />
      </View>

      <View style={styles.intro}>
        <Text style={styles.eyebrow}>PROFILE</Text>
        <Text style={styles.title}>Your household</Text>
        <Text style={styles.copy}>The details your Lifestyle Manager uses to understand who they are helping and where.</Text>
      </View>

      <View style={styles.card}>
        <InfoRow label="Email" value={user?.email} />
        <View style={styles.divider} />
        <InfoRow label="Name" value={profile?.name} />
        <View style={styles.divider} />
        <InfoRow label="Mobile number" value={profile?.mobile} />
        <View style={styles.divider} />
        <InfoRow label="Address" value={profile?.address} />
        <View style={styles.divider} />
        <InfoRow label="Business name" value={profile?.businessName} />
      </View>

      <View style={styles.nextCard}>
        <Text style={styles.nextEyebrow}>YOUR SERVICES</Text>
        <Text style={styles.nextTitle}>Need to change what Padosi handles?</Text>
        <Text style={styles.nextCopy}>Add or remove services from your current selection.</Text>
        <Button label="Change services" onPress={() => router.push('/(app)/tasks')} secondary testID="profile-change-services" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: 28 },
  header: { alignItems: 'flex-start' },
  intro: { gap: spacing.sm },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 40, fontWeight: '900' },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg
  },
  infoRow: { gap: 4, paddingVertical: 4 },
  infoLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  infoValue: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.sm },
  nextCard: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  nextEyebrow: { color: '#DCD9D0', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  nextTitle: { color: colors.white, fontSize: 20, lineHeight: 25, fontWeight: '900' },
  nextCopy: { color: '#DCD9D0', fontSize: 14, lineHeight: 20, marginBottom: 4 }
});
