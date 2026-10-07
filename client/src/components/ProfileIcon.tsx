import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type ProfileIconProps = {
  size?: number;
};

export function ProfileIcon({ size = 48 }: ProfileIconProps) {
  const headSize = size * 0.22;
  const shoulderWidth = size * 0.46;
  const shoulderHeight = size * 0.25;

  return (
    <View style={[styles.icon, { width: size, height: size, borderRadius: size / 2 }]} accessible={false}>
      <View style={[styles.head, { width: headSize, height: headSize, borderRadius: headSize / 2, marginBottom: size * 0.08 }]} />
      <View style={[styles.shoulders, { width: shoulderWidth, height: shoulderHeight, borderRadius: shoulderWidth / 2, borderBottomLeftRadius: shoulderWidth / 4, borderBottomRightRadius: shoulderWidth / 4 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  head: { backgroundColor: colors.ink },
  shoulders: { backgroundColor: colors.ink }
});
