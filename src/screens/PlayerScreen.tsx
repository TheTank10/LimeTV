// screens/PlayerScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import VideoPlayer from 'react-native-media-console';
import Orientation from 'react-native-orientation-locker';

interface SubtitleOption {
  title: string;
  language: string;
  uri: string;
}

interface PlayerScreenProps {
  route: {
    params: {
      videoUrl: string;
      title: string;
      subtitle?: string;
      subtitles?: SubtitleOption[];
    };
  };
  navigation: any;
}

export const PlayerScreen: React.FC<PlayerScreenProps> = ({ route, navigation }) => {
  const { videoUrl, title, subtitle, subtitles = [] } = route.params;
  
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Lock to landscape when component mounts
    Orientation.lockToLandscape();
    StatusBar.setHidden(true);

    return () => {
      // Reset to portrait when leaving
      Orientation.lockToPortrait();
      StatusBar.setHidden(false);
    };
  }, []);

  // Convert subtitles to textTracks format
  const textTracks = subtitles.map((sub) => ({
    title: sub.title,
    language: sub.language as any,
    type: 'application/x-subrip' as any,
    uri: sub.uri,
  }));

  const handleEnterFullscreen = () => {
    setIsFullscreen(true);
    Orientation.lockToLandscape();
    StatusBar.setHidden(true);
  };

  const handleExitFullscreen = () => {
    setIsFullscreen(false);
    Orientation.lockToPortrait();
    StatusBar.setHidden(false);
  };

  const handleBack = () => {
    Orientation.lockToPortrait();
    StatusBar.setHidden(false);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <VideoPlayer
        source={{ uri: videoUrl }}
        onBack={handleBack}
        onEnterFullscreen={handleEnterFullscreen}
        onExitFullscreen={handleExitFullscreen}
        title={title}
        textTracks={textTracks}
        selectedTextTrack={
          textTracks.length > 0
            ? {
                type: 'language' as any,
                value: textTracks[0].language,
              }
            : undefined
        }
        resizeMode="contain"
        disableBack={false}
        disableVolume={false}
        disableFullscreen={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});