import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, SPACING } from '../constants';
import { AVAILABLE_LANGUAGES } from '../constants/languages';
import { SubtitleLanguage } from '../types';

interface LanguagePickerProps {
  visible: boolean;
  selectedLanguages: SubtitleLanguage[];
  onSelect: (language: SubtitleLanguage) => void;
  onClose: () => void;
}

export const LanguagePicker: React.FC<LanguagePickerProps> = ({
  visible,
  selectedLanguages,
  onSelect,
  onClose,
}) => {
  const isLanguageSelected = (code: string) => {
    return selectedLanguages.some(l => l.code === code);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.languageList}>
            {AVAILABLE_LANGUAGES.map((language) => {
              const isSelected = isLanguageSelected(language.code);
              return (
                <TouchableOpacity
                  key={language.code}
                  style={[
                    styles.languageItem,
                    isSelected && styles.languageItemSelected,
                  ]}
                  onPress={() => {
                    if (!isSelected) {
                      onSelect(language);
                      onClose();
                    }
                  }}
                  disabled={isSelected}
                >
                  <Text style={[
                    styles.languageName,
                    isSelected && styles.languageNameSelected,
                  ]}>
                    {language.name}
                  </Text>
                  {isSelected && (
                    <Text style={styles.selectedCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  languageList: {
    padding: SPACING.md,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  languageItemSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    opacity: 0.5,
  },
  languageName: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  languageNameSelected: {
    color: COLORS.textDark,
  },
  selectedCheck: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '600',
  },
});