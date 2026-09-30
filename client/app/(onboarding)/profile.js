import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { saveProfile } from '../../src/api/profile';
import { Button } from '../../src/components/Button';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/state/auth';
import { colors, spacing } from '../../src/theme';
import { validateMobile } from '../../src/utils/form';

export default function Profile() {
  const { updateProfile, profile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [mobile, setMobile] = useState(profile?.mobile || '+91');
  const [address, setAddress] = useState(profile?.address || '');
  const [businessName, setBusinessName] = useState(profile?.businessName || '');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next = {};
    if (name.trim().length < 2) next.name = 'Enter your name';
    if (!validateMobile(mobile)) next.mobile = 'Use +91 followed by 10 digits';
    if (address.trim().length < 5) next.address = 'Add your address';
    setErrors(next);
    setMessage('');
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const saved = await saveProfile({ name: name.trim(), mobile: mobile.trim(), address: address.trim(), businessName: businessName.trim() });
      updateProfile(saved);
      router.replace('/(app)/tasks');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <Text style={styles.eyebrow}>A QUICK INTRO</Text>
      <Text style={styles.title}>Tell us enough to make this useful.</Text>
      <Text style={styles.copy}>This is shown once, right after your first login. Your Lifestyle Manager uses it to understand the household.</Text>
      <Field label="Name" value={name} onChangeText={setName} error={errors.name} />
      <Field label="Mobile number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" error={errors.mobile} />
      <Field label="Address" value={address} onChangeText={setAddress} multiline error={errors.address} />
      <Field label="Business name (optional)" value={businessName} onChangeText={setBusinessName} error={errors.businessName} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Button label="Continue" onPress={submit} loading={loading} testID="profile-submit" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: 48 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 40, fontWeight: '900' },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 23, marginBottom: spacing.sm },
  message: { color: colors.danger, fontSize: 14 }
});
