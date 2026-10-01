import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function AccountMenu({ visible, onClose, onProfile, onLogout }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close account menu" />
        <View style={styles.menu}>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
          <Pressable
            onPress={onProfile}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View>
              <Text style={styles.itemTitle}>Profile</Text>
              <Text style={styles.itemCopy}>View your household details</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable
            onPress={onLogout}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            style={({ pressed }) => [styles.item, styles.lastItem, pressed && styles.pressed]}
          >
            <View>
              <Text style={styles.itemTitle}>Log out</Text>
              <Text style={styles.itemCopy}>End this session on this device</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(27, 27, 24, 0.34)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: 92
  },
  menu: {
    width: 280,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.sm,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: 4
  },
  item: {
    minHeight: 64,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  lastItem: {
    marginTop: 2
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800'
  },
  itemCopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  chevron: {
    color: colors.muted,
    fontSize: 24,
    lineHeight: 24,
    paddingHorizontal: 4
  },
  pressed: {
    backgroundColor: '#F2EEE5'
  }
});
