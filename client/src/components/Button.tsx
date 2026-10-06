import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, loading = false, disabled = false, secondary = false, testID }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondary : styles.primary,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed
      ]}
    >
      {loading ? <ActivityIndicator color={secondary ? colors.accent : colors.white} /> : <Text style={[styles.text, secondary && styles.secondaryText]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  text: { color: colors.white, fontSize: 16, fontWeight: '700' },
  secondaryText: { color: colors.ink },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.99 }] }
});
