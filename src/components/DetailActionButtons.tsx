import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, Platform } from 'react-native';
//import * as FileSystem from 'expo-file-system/legacy';
//import * as MediaLibrary from 'expo-media-library';
import { SPACING, COLORS, FONT_SIZES, BORDER_RADIUS } from '../constants';

interface DetailActionButtonsProps {
  onPlay: () => void;
  videoUrl?: string;
  title: string;
}

/**
 * Action buttons for detail screen (Play, Download, Share)
 */
export const DetailActionButtons: React.FC<DetailActionButtonsProps> = ({ 
  onPlay, 
  videoUrl,
  title 
}) => {
  const [downloading, setDownloading] = React.useState(false);

  //const handleDownload = async () => {
  //  if (!videoUrl) {
  //    Alert.alert('Error', 'No video available to download');
  //    return;
  //  }

    // Note: HLS streams (.m3u8) can't be downloaded directly
  //  if (videoUrl.includes('.m3u8')) {
      Alert.alert('Not Supported', 'HLS streams cannot be downloaded. Only MP4 files are supported.');
  //    return;
  //  }

  //  try {
  //    setDownloading(true);

      // Request permissions
  //    const { status } = await MediaLibrary.requestPermissionsAsync();
  //    if (status !== 'granted') {
  //      Alert.alert('Permission Required', 'Please grant media library access to download videos');
  //      return;
  //    }

      // Create file name
  //    const fileName = `${title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.mp4`;
  //    const fileUri = FileSystem.documentDirectory + fileName;

      // Download file
   //   const { uri } = await FileSystem.downloadAsync(videoUrl, fileUri);
      
      // Save to photo library
  //    await MediaLibrary.createAssetAsync(uri);
  //    Alert.alert('Success', 'Video downloaded to your photo library');
  //  } catch (error) {
  //    console.error('Download error:', error);
  //    Alert.alert('Download Failed', 'Could not download video');
  //  } finally {
  //    setDownloading(false);
  //  }
  //};

  const handleShare = () => {
    // Implement share functionality later
    Alert.alert('Share', 'Share functionality coming soon');
  };

  return (
    <View style={styles.actionButtons}>
      <TouchableOpacity style={styles.playButton} onPress={onPlay}>
        <Text style={styles.playButtonText}>▶  Play</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.iconButton, downloading && styles.iconButtonDisabled]} 
        //onPress={handleDownload}
        disabled={downloading}
      >
        <Text style={styles.iconButtonText}>
          {downloading ? '⏳' : '⬇'}
        </Text>
        <Text style={styles.iconButtonLabel}>
          {downloading ? 'Saving...' : 'Download'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
        <Text style={styles.iconButtonText}>↗</Text>
        <Text style={styles.iconButtonLabel}>Share</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  playButton: {
    flex: 1,
    backgroundColor: COLORS.buttonLight,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.buttonDark,
  },
  iconButton: {
    backgroundColor: COLORS.overlay,
    width: 70,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  iconButtonText: {
    fontSize: 20,
    color: COLORS.text,
    marginBottom: 2,
  },
  iconButtonLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
});