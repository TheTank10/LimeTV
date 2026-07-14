import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SPACING, COLORS } from '../../constants';

interface DetailHeaderProps {
  onClose: () => void;
}

/**
 * Detail screen header with close button
 */
export const DetailHeader: React.FC<DetailHeaderProps> = ({ onClose }) => {
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity 
      style={[
        styles.closeButton, 
        { top: Math.max(insets.top, SPACING.sm) }
      ]} 
      onPress={onClose}
    >
      <Text style={styles.closeText}>✕</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  closeButton: {
    position: 'absolute',
    right: SPACING.lg,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  closeText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '300',
  },
});