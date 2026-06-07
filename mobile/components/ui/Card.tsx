// components/ui/Card.tsx

import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  style?: ViewStyle;
}

export function Card({ children, title, style }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    padding: 18,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#EEE5D8',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5A4636',
    marginBottom: 10,
  },
});

export default Card;
