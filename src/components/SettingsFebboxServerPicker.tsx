import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants';
import { LinearGradient } from 'expo-linear-gradient';
import { Server } from '../hooks/useFebboxServer';
import { SettingsFebboxServerItem } from './SettingsFebboxServerItem';

interface SettingsFebboxServerPickerProps {
  visible: boolean;
  servers: Server[];
  selectedServer: Server | null;
  onSelect: (server: Server) => void;
  onClose: () => void;
}

export const SettingsFebboxServerPicker: React.FC<SettingsFebboxServerPickerProps> = ({
  visible,
  servers,
  selectedServer,
  onSelect,
  onClose,
}) => {
  const handleSelect = (server: Server) => {
    onSelect(server);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient colors={COLORS.backgroundGradient} style={styles.gradient}>
          <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Select Server</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={onClose}
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Server List */}
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.content}>
                <View style={styles.section}>
                  {servers.map((server, index) => (
                    <View key={server.group_id}>
                      {index > 0 && <View style={styles.divider} />}
                      <SettingsFebboxServerItem
                        server={server}
                        isSelected={selectedServer?.group_id === server.group_id}
                        onSelect={() => handleSelect(server)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </View>
    </Modal>
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
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});