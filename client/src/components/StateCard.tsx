import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, radius, spacing } from '../theme';

type StateCardProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StateCard({ title, message, actionLabel, onAction }: StateCardProps) {
  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} secondary /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, gap: spacing.sm },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  message: { color: colors.muted, fontSize: 14, lineHeight: 20 }
});
