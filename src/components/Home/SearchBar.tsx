import React, { useRef } from 'react';
import { View, TextInput, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  scale?: Animated.Value;
  translateY?: Animated.Value;
}

/**
 * Search bar with blur background and clear button
 * Clean minimal design
 */
export const SearchBar: React.FC<Props> = ({
  value,
  onChangeText,
  onClear,
  scale,
}) => {
  const inputRef = useRef<TextInput>(null);

  const animatedStyle = {
    transform: [
      { scale: scale || 1 },
    ],
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
        <BlurView intensity={90} tint="dark" style={styles.blur}>
          <View style={styles.searchContent}>
            <Ionicons name="search" size={18} color={COLORS.textDark} style={styles.searchIcon} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Search movies & shows..."
              placeholderTextColor={COLORS.textDark}
              value={value}
              onChangeText={onChangeText}
              returnKeyType="search"
            />
            {value.length > 0 && (
              <TouchableOpacity style={styles.clearButton} onPress={onClear}>
                <Ionicons name="close-circle" size={18} color={COLORS.textDark} />
              </TouchableOpacity>
            )}
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.md,
  },
  blur: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '400',
  },
  clearButton: {
    padding: 4,
  },
});