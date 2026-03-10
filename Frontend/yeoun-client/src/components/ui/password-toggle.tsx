import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
}

/**
 * Eye button that toggles password visibility.
 * - visible = true  → eye-outline (no line)
 * - visible = false → eye-off-outline (diagonal line)
 */
export function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={styles.button}
      accessibilityLabel={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons
        name={visible ? 'eye-outline' : 'eye-off-outline'}
        size={20}
        color="#CACACA"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
  },
});
