import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SPACING, COLORS, FONT_SIZES } from '../constants';

interface DetailShareLinkSectionProps {
  onSubmit: (shareKey: string) => Promise<void>;
  onClear?: () => Promise<void>;
  mediaType: string;
  season?: number;
  episode?: number;
  existingShareKey?: string;
}

/**
 * Display and edit FebBox share link
 */
export const DetailShareLinkSection: React.FC<DetailShareLinkSectionProps> = ({
  onSubmit,
  onClear,
  mediaType,
  season,
  episode,
  existingShareKey,
}) => {
  const [shareKey, setShareKey] = useState(existingShareKey || '');
  const [isSaved, setIsSaved] = useState(!!existingShareKey);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmedKey = shareKey.trim();
    
    if (!trimmedKey) {
      return;
    }

    // Don't save if it hasn't changed
    if (trimmedKey === existingShareKey) {
      return;
    }

    try {
      setLoading(true);
      await onSubmit(trimmedKey);
      setIsSaved(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to save share link');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => { 
    setShareKey('');
    setIsSaved(false);
    
    if (onClear) {
      try {
        await onClear();
      } catch (error) {
        console.error('Error clearing share key:', error);
      }
    }
  };

  const handleChangeText = (text: string) => {
    setShareKey(text);
    setIsSaved(false);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>
        FebBox Share Key {isSaved && <Text style={styles.savedIndicator}>✓ Saved</Text>}
      </Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Paste share key or link"
          placeholderTextColor={COLORS.textMuted}
          value={shareKey}
          onChangeText={handleChangeText}
          onBlur={handleSubmit}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        {shareKey.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={handleClear}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  savedIndicator: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: COLORS.overlay,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingRight: 40,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  clearButton: {
    position: 'absolute',
    right: SPACING.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  clearButtonText: {
    fontSize: 20,
    color: COLORS.textMuted,
    fontWeight: '300',
  },
});