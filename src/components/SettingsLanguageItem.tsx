import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { SubtitleLanguage } from '../types';

interface LanguageItemProps {
  language: SubtitleLanguage;
  onRemove: () => void;
}

export const LanguageItem: React.FC<LanguageItemProps> = ({ language, onRemove }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.languageName}>{language.name}</Text>
      <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
        <Ionicons name="trash-outline" size={20} color="#ff4444" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  languageName: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
  },
});