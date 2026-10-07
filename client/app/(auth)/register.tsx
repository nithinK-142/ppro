import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { register as registerRequest } from '../../src/api/auth';
import { Button } from '../../src/components/Button';
import { Field } from '../../src/components/Field';
import { AuthScreen } from '../../src/components/AuthScreen';
import { colors, spacing } from '../../src/theme';
import { validateCredentials } from '../../src/utils/form';
import { getErrorMessage } from '../../src/utils/errors';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next = validateCredentials(email, password, confirmPassword);
    setErrors(next);
    setMessage('');
    if (Object.keys(next).length) return;

    const normalizedEmail = email.trim().toLowerCase();

    setLoading(true);
    try {
      await registerRequest({ email: normalizedEmail, password, confirmPassword });
      router.push({ pathname: '/(auth)/verify', params: { email: normalizedEmail } });
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, 'Unable to create account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen contentStyle={styles.content}>
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
    </AuthScreen>
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
