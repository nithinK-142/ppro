import { ScrollView, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ children, scroll = true, contentStyle }: ScreenProps) {
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
