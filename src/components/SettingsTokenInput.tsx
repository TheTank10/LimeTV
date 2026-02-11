import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { TokenState } from '../types';

interface TokenInputProps {
  token: TokenState;
  onUpdate: (value: string) => void;
  onRemove: () => void;
}

export const TokenInput: React.FC<TokenInputProps> = ({ token, onUpdate, onRemove }) => {
  const getStatusIcon = (status: TokenState['status']) => {
    switch (status) {
      case 'validating':
        return <ActivityIndicator size="small" color={COLORS.textDark} />;
      case 'valid':
        return <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />;
      case 'invalid':
        return <Ionicons name="close-circle" size={22} color="#ff4444" />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Paste UI Token here..."
          placeholderTextColor={COLORS.textDark}
          value={token.value}
          onChangeText={onUpdate}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {token.data && token.status === 'valid' && (
          <View style={styles.info}>
            <Text style={styles.infoText}>
              {token.data.traffic_usage} / {token.data.traffic_limit}
            </Text>
            <Text style={styles.infoSubtext}>
              Resets in {token.data.reset_at}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.actions}>
        {getStatusIcon(token.status)}
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <Ionicons name="trash-outline" size={20} color="#ff4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  info: {
    marginTop: 8,
    paddingLeft: 4,
  },
  infoText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  infoSubtext: {
    color: COLORS.textDark,
    fontSize: 11,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
  },
  removeButton: {
    padding: 4,
  },
});