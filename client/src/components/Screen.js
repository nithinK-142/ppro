import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export function Screen({ children, scroll = true, contentStyle }) {
  if (!scroll) {
    return <SafeAreaView style={styles.safe}><View style={[styles.screen, contentStyle]}>{children}</View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  content: { flexGrow: 1, backgroundColor: colors.background, padding: spacing.lg, paddingBottom: 48 }
});
