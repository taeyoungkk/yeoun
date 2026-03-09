import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
} from 'react-native';
import { ReactNode } from 'react';

interface FormFieldProps extends TextInputProps {
  error?: string;
  /** Optional element rendered on the right side of the input (e.g. eye toggle) */
  rightElement?: ReactNode;
}

/**
 * Reusable form field that wraps a TextInput with a border,
 * optional right-side element, and an inline error message.
 */
export function FormField({ error, rightElement, style, ...rest }: FormFieldProps) {
  const hasRight = !!rightElement;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.inputRow, !!error && styles.inputError]}>
        <TextInput
          style={[styles.input, hasRight && styles.inputWithRight, style]}
          placeholderTextColor="#CACACA"
          {...rest}
        />
        {hasRight && <View style={styles.rightSlot}>{rightElement}</View>}
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBCBCB',
    borderRadius: 15,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    color: '#333333',
  },
  inputWithRight: {
    paddingRight: 8,
  },
  inputError: {
    borderColor: '#E53935',
  },
  rightSlot: {
    paddingLeft: 4,
  },
  errorText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 12,
    color: '#3629B7',
    marginTop: 4,
    marginLeft: 4,
  },
});
