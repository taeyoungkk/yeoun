import { ReactNode, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

interface FormFieldProps extends TextInputProps {
  error?: string;
  /** Optional element rendered on the right side of the input (e.g. eye toggle) */
  rightElement?: ReactNode;
}

/**
 * Reusable form field that wraps a TextInput with a border,
 * optional right-side element, and an inline error message.
 * The entire row highlights on focus rather than just the TextInput.
 */
export function FormField({
  error,
  rightElement,
  style,
  onFocus,
  onBlur,
  ...rest
}: FormFieldProps) {
  const hasRight = !!rightElement;
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.inputRow,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      >
        <TextInput
          style={[
            styles.input,
            hasRight && styles.inputWithRight,
            style,
            { outlineWidth: 0 } as any,
          ]}
          placeholderTextColor="#CACACA"
          underlineColorAndroid="transparent"
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
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
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBCBCB",
    borderRadius: 15,
    paddingHorizontal: 16,
  },
  inputFocused: {
    borderColor: "blue",
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontFamily: "Poppins",
    fontWeight: "500",
    fontSize: 14,
    color: "#333333",
  },
  inputWithRight: {
    paddingRight: 8,
  },
  inputError: {
    borderColor: "#E53935",
  },
  rightSlot: {
    paddingLeft: 4,
  },
  errorText: {
    fontFamily: "Poppins",
    fontWeight: "600",
    fontSize: 12,
    color: "#3629B7",
    marginTop: 4,
    marginLeft: 4,
  },
});
