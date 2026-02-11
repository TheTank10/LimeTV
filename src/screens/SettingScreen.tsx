import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useFebBoxTokens, useSubtitleLanguages } from '../hooks';
import { TokenInput, LanguagePicker, LanguageItem } from '../components';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { tokens, isLoading: tokensLoading, addToken, updateToken, removeToken } = useFebBoxTokens();
  const { languages, isLoading: languagesLoading, addLanguage, removeLanguage } = useSubtitleLanguages();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const isLoading = tokensLoading || languagesLoading;

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.text} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={COLORS.backgroundGradient} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Settings Content */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              
              {/* FebBox Section */}
              <Text style={styles.sectionHeader}>FEBBOX</Text>
              <View style={styles.section}>
                <TouchableOpacity style={styles.addButton} onPress={addToken}>
                  <Ionicons name="add-circle-outline" size={22} color="rgba(201, 255, 0, 0.9)" />
                  <Text style={styles.addButtonText}>Add UI Token</Text>
                </TouchableOpacity>

                {tokens.length > 0 && <View style={styles.divider} />}

                {tokens.map((token, index) => (
                  <View key={index}>
                    {index > 0 && <View style={styles.divider} />}
                    <TokenInput
                      token={token}
                      onUpdate={(value) => updateToken(index, value)}
                      onRemove={() => removeToken(index)}
                    />
                  </View>
                ))}
              </View>

              <View style={styles.noteContainer}>
                <Text style={styles.noteText}>
                  <Text style={styles.noteBold}>Note:</Text> To get more Febbox UI tokens use multiple browsers or devices. Logging out of your account resets the UI token.
                </Text>
              </View>

              {/* Subtitles Section */}
              <Text style={styles.sectionHeader}>SUBTITLES</Text>
              <View style={styles.section}>
                <TouchableOpacity 
                  style={styles.addButton} 
                  onPress={() => setShowLanguagePicker(true)}
                >
                  <Ionicons name="add-circle-outline" size={22} color="rgba(201, 255, 0, 0.9)" />
                  <Text style={styles.addButtonText}>Add Language</Text>
                </TouchableOpacity>

                {languages.length > 0 && <View style={styles.divider} />}

                {languages.map((language, index) => (
                  <View key={language.code}>
                    {index > 0 && <View style={styles.divider} />}
                    <LanguageItem
                      language={language}
                      onRemove={() => removeLanguage(language.code)}
                    />
                  </View>
                ))}
              </View>

              <View style={styles.noteContainer}>
                <Text style={styles.noteText}>
                  <Text style={styles.noteBold}>Note:</Text> Selected languages will appear in the player when you click the 'CC' button.
                </Text>
              </View>

              {/* Version */}
              <Text style={styles.version}>Version 1.0.0</Text>
            </View>
          </ScrollView>

          {/* Language Picker Modal */}
          <LanguagePicker
            visible={showLanguagePicker}
            selectedLanguages={languages}
            onSelect={addLanguage}
            onClose={() => setShowLanguagePicker(false)}
          />
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  addButtonText: {
    fontSize: 16,
    color: 'rgba(201, 255, 0, 0.9)',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  noteContainer: {
    marginTop: 12,
    marginHorizontal: 4,
  },
  noteText: {
    color: COLORS.textDark,
    fontSize: 12,
    lineHeight: 18,
  },
  noteBold: {
    fontWeight: '600',
    color: COLORS.text,
  },
  version: {
    textAlign: 'center',
    color: COLORS.textDark,
    fontSize: 13,
    marginTop: 40,
    marginBottom: 20,
  },
});