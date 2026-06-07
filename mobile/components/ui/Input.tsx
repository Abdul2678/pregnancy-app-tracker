// components/ui/Input.tsx

import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...rest }: InputProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#B7A992"
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#5A4636', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#D8CDBE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#3D2F22',
  },
  inputError: { borderColor: '#C0524A' },
  error: { color: '#C0524A', fontSize: 12, marginTop: 4 },
});

export default Input;
