import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { resendVerification, verifyEmail } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { Button } from '../../src/components/Button';
import { AuthScreen } from '../../src/components/AuthScreen';
import { colors, radius, spacing } from '../../src/theme';
import { getErrorMessage } from '../../src/utils/errors';

export default function Verify() {
  const params = useLocalSearchParams();
  const email = String(params.email ?? '');
  const [otp, setOtp] = useState('');
  const [seconds, setSeconds] = useState(30);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setInterval(() => setSeconds((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  const canSubmit = /^\d{6}$/.test(otp);

  const verify = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setMessage('');
    try {
      await verifyEmail({ email, otp });
      router.replace({ pathname: '/(auth)/login', params: { verified: '1' } });
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, 'Unable to verify email.'));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setMessage('');
    try {
      await resendVerification(email);
      setSeconds(30);
      setOtp('');
    } catch (error: unknown) {
      const retryAfterSeconds = error instanceof ApiError ? error.details.retryAfterSeconds : undefined;
      if (error instanceof ApiError && error.code === 'OTP_COOLDOWN' && typeof retryAfterSeconds === 'number') {
        setSeconds(retryAfterSeconds);
      }
      setMessage(getErrorMessage(error, 'Unable to resend verification code.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthScreen contentStyle={styles.content}>
        <Text style={styles.eyebrow}>CHECK YOUR EMAIL</Text>
        <Text style={styles.title}>Six digits. Then you're in.</Text>
        <Text style={styles.copy}>We sent a verification code to <Text style={styles.email}>{email}</Text>. It is valid for 10 minutes.</Text>
        <TextInput
          value={otp}
          onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          style={styles.otp}
          accessibilityLabel="Email verification code"
          testID="otp-input"
        />
        {message ? <Text style={styles.message} accessibilityRole="alert">{message}</Text> : null}
        <Button label="Verify email" onPress={verify} loading={loading} disabled={!canSubmit} testID="verify-submit" />
        <View style={styles.resendRow}>
          <Text style={styles.resendText}>{seconds > 0 ? `Resend in ${seconds}s` : 'Did not get it?'}</Text>
          {seconds === 0 ? <Button label="Send again" onPress={resend} loading={resending} secondary /> : null}
        </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: 56 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 40, fontWeight: '900' },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  email: { color: colors.ink, fontWeight: '700' },
  otp: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, paddingVertical: 16, textAlign: 'center', fontSize: 34, letterSpacing: 10, color: colors.ink, marginVertical: spacing.sm },
  message: { color: colors.danger, fontSize: 14 },
  resendRow: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  resendText: { color: colors.muted, fontSize: 14 }
});
