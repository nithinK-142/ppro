import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { register as registerRequest } from '../../src/api/auth';
import { Button } from '../../src/components/Button';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import { colors, spacing } from '../../src/theme';
import { validateEmail, validatePassword } from '../../src/utils/form';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!validateEmail(email)) next.email = 'Enter a valid email';
    if (!validatePassword(password)) next.password = 'Use at least 8 characters';
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    setMessage('');
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await registerRequest({ email: email.trim().toLowerCase(), password, confirmPassword });
      router.push({ pathname: '/(auth)/verify', params: { email: email.trim().toLowerCase() } });
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen contentStyle={styles.content}>
        <Text style={styles.eyebrow}>SET UP YOUR PADOSIPRO</Text>
        <Text style={styles.title}>Start with the account. The rest follows.</Text>
        <Text style={styles.copy}>Use an email you can access now. We will send a six-digit verification code.</Text>
        <View style={styles.form}>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry error={errors.password} />
          <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry error={errors.confirmPassword} />
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Button label="Create account" onPress={submit} loading={loading} testID="register-submit" />
          <Text style={styles.bottom}>Already have an account? <Link href="/(auth)/login" style={styles.link}>Sign in</Link></Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: 48 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 40, fontWeight: '900' },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  form: { gap: spacing.md, marginTop: spacing.lg },
  message: { color: colors.danger, fontSize: 14 },
  bottom: { textAlign: 'center', color: colors.muted, fontSize: 14 },
  link: { color: colors.ink, fontWeight: '800' }
});
