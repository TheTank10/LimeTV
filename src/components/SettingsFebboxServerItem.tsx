import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { Server } from '../hooks/useFebboxServer';

interface SettingsFebboxServerItemProps {
  server: Server;
  isSelected: boolean;
  onSelect: () => void;
}

export const SettingsFebboxServerItem: React.FC<SettingsFebboxServerItemProps> = ({ server, isSelected, onSelect }) => {
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.country}>{server.country}</Text>
          <Text style={styles.description}>{server.description}</Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="rgba(201, 255, 0, 0.9)" />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
  },
  country: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
    color: COLORS.textDark,
  },
});