import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { Screen } from './Screen';
import type { StyleProp, ViewStyle } from 'react-native';

type AuthScreenProps = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function AuthScreen({ children, contentStyle }: AuthScreenProps) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Screen contentStyle={contentStyle}>{children}</Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }
});
