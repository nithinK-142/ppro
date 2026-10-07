import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { Button } from '../../src/components/Button';
import { Field } from '../../src/components/Field';
import { AuthScreen } from '../../src/components/AuthScreen';
import { useAuth } from '../../src/state/auth';
import { colors, spacing } from '../../src/theme';
import { validateCredentials } from '../../src/utils/form';
import { getErrorMessage } from '../../src/utils/errors';

export default function Login() {
  const { signIn } = useAuth();
  const params = useLocalSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(params.verified === '1' ? 'Email verified. Sign in to continue.' : '');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next = validateCredentials(email, password);
    setErrors(next);
    setMessage('');
    if (Object.keys(next).length) return;

    const normalizedEmail = email.trim().toLowerCase();

    setLoading(true);
    try {
      await signIn(normalizedEmail, password);
      router.replace('/');
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED') {
        router.push({ pathname: '/(auth)/verify', params: { email: normalizedEmail } });
      } else {
        setMessage(getErrorMessage(error, 'Unable to sign in.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen contentStyle={styles.content}>
        <View style={styles.mark}><Text style={styles.markText}>PADOSI</Text><Text style={styles.dot}>PRO</Text></View>
        <View style={styles.hero}>
          <Text style={styles.kicker}>YOUR TO-DO, HANDLED</Text>
          <Text style={styles.title}>One person to take the small jobs off your plate.</Text>
          <Text style={styles.copy}>Sign in to continue setting up what you want your Lifestyle Manager to handle.</Text>
        </View>
        <View style={styles.form}>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry error={errors.password} />
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Button label="Sign in" onPress={submit} loading={loading} testID="login-submit" />
          <Text style={styles.bottom}>New here? <Link href="/(auth)/register" style={styles.link}>Create an account</Link></Text>
        </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: 34 },
  mark: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  markText: { color: colors.ink, fontSize: 18, fontWeight: '900', letterSpacing: 1.4 },
  dot: { color: colors.accent, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  hero: { gap: spacing.sm, maxWidth: 520 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 36, lineHeight: 42, fontWeight: '900' },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  form: { gap: spacing.md },
  message: { color: colors.danger, fontSize: 14 },
  bottom: { textAlign: 'center', color: colors.muted, fontSize: 14 },
  link: { color: colors.ink, fontWeight: '800' }
});
