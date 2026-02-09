// screens/PlayerScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, TouchableOpacity, Text } from 'react-native';
import Video, { 
  TextTrackType, 
  VideoRef, 
  SelectedTrackType 
} from 'react-native-video';
import MediaControls, { PLAYER_STATES } from 'react-native-media-controls';
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
  const { videoUrl, title, subtitles = [] } = route.params;
  
  const videoRef = useRef<VideoRef>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [playerState, setPlayerState] = useState(PLAYER_STATES.PLAYING);
  const [selectedTextTrack, setSelectedTextTrack] = useState<number>(-1);
  const [showSubtitlePicker, setShowSubtitlePicker] = useState(false);

  useEffect(() => {
    // Lock to landscape and hide status bar on mount
    Orientation.lockToLandscape();
    StatusBar.setHidden(true);

    return () => {
      // Reset to portrait and show status bar when leaving
      Orientation.lockToPortrait();
      StatusBar.setHidden(false);
    };
  }, []);

  // Convert subtitles to react-native-video format
  // Cast language to 'any' to bypass ISO639_1 type checking
  const textTracks = [
    { 
      title: 'Off', 
      language: 'off' as any, 
      type: TextTrackType.VTT, 
      uri: '' 
    },
    ...subtitles.map((sub) => ({
      title: sub.title,
      language: sub.language as any, // Cast to any to bypass ISO639_1 type
      type: TextTrackType.VTT, // Change to TextTrackType.SUBRIP if using .srt files
      uri: sub.uri,
    })),
  ];

  const onSeek = (seek: number) => {
    videoRef.current?.seek(seek);
  };

  // IMPORTANT: onPaused receives PLAYER_STATES, not a boolean!
  const onPaused = (newPlayerState: PLAYER_STATES) => {
    const shouldPause = newPlayerState === PLAYER_STATES.PAUSED;
    setPaused(shouldPause);
    setPlayerState(newPlayerState);
  };

  const onReplay = () => {
    setPlayerState(PLAYER_STATES.PLAYING);
    videoRef.current?.seek(0);
    setPaused(false);
  };

  const onProgress = (data: any) => {
    if (!isLoading && playerState !== PLAYER_STATES.ENDED) {
      setCurrentTime(data.currentTime);
    }
  };

  const onLoad = (data: any) => {
    setDuration(data.duration);
    setIsLoading(false);
  };

  const onLoadStart = () => {
    setIsLoading(true);
  };

  const onEnd = () => {
    setPlayerState(PLAYER_STATES.ENDED);
    setPaused(true);
  };

  const onError = (error: any) => {
    console.error('Video Error:', error);
    setIsLoading(false);
  };

  const handleBack = () => {
    Orientation.lockToPortrait();
    StatusBar.setHidden(false);
    navigation.goBack();
  };

  const onSeeking = (currentVideoTime: number) => {
    setCurrentTime(currentVideoTime);
  };

  const toggleSubtitlePicker = () => {
    setShowSubtitlePicker(!showSubtitlePicker);
  };

  const selectSubtitle = (index: number) => {
    setSelectedTextTrack(index);
    setShowSubtitlePicker(false);
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        style={styles.video}
        resizeMode="contain"
        paused={paused}
        onProgress={onProgress}
        onLoad={onLoad}
        onLoadStart={onLoadStart}
        onEnd={onEnd}
        onError={onError}
        // Subtitle configuration
        textTracks={textTracks}
        selectedTextTrack={
          selectedTextTrack === -1 || selectedTextTrack === 0
            ? { type: SelectedTrackType.DISABLED }  
            : {
                type: SelectedTrackType.INDEX,  
                value: selectedTextTrack - 1,      
              }
        }
        ignoreSilentSwitch="ignore"
        playInBackground={false}
        playWhenInactive={false}
        bufferConfig={{
          minBufferMs: 15000,
          maxBufferMs: 50000,
          bufferForPlaybackMs: 2500,
          bufferForPlaybackAfterRebufferMs: 5000,
        }}
      />
      
      <MediaControls
        duration={duration}
        isLoading={isLoading}
        mainColor="#FF6B6B"
        onPaused={onPaused}
        onReplay={onReplay}
        onSeek={onSeek}
        onSeeking={onSeeking}
        playerState={playerState}
        progress={currentTime}
        showOnStart={true}
        sliderStyle={{ containerStyle: {}, thumbStyle: {}, trackStyle: {} }}
        toolbarStyle={styles.toolbar}
        containerStyle={styles.mediaControlsContainer}
        isFullScreen={true}
      >
        {/* Custom toolbar with subtitle button */}
        <MediaControls.Toolbar>
          <View style={styles.toolbarContainer}>
            <TouchableOpacity onPress={handleBack} style={styles.toolbarButton}>
              <Text style={styles.toolbarButtonText}>← Back</Text>
            </TouchableOpacity>
            
            {subtitles.length > 0 && (
              <TouchableOpacity onPress={toggleSubtitlePicker} style={styles.toolbarButton}>
                <Text style={styles.toolbarButtonText}>CC</Text>
              </TouchableOpacity>
            )}
          </View>
        </MediaControls.Toolbar>

        {/* Custom subtitle picker overlay */}
        {showSubtitlePicker && (
          <View style={styles.subtitlePickerContainer}>
            <View style={styles.subtitlePicker}>
              <Text style={styles.subtitlePickerTitle}>Subtitles</Text>
              {textTracks.map((track, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.subtitleOption,
                    selectedTextTrack === index && styles.subtitleOptionSelected,
                  ]}
                  onPress={() => selectSubtitle(index)}
                >
                  <Text
                    style={[
                      styles.subtitleOptionText,
                      selectedTextTrack === index && styles.subtitleOptionTextSelected,
                    ]}
                  >
                    {track.title}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.subtitleCloseButton}
                onPress={() => setShowSubtitlePicker(false)}
              >
                <Text style={styles.subtitleCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </MediaControls>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  mediaControlsContainer: {
    flex: 1,
  },
  toolbar: {
    backgroundColor: 'transparent',
  },
  toolbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    width: '100%',
  },
  toolbarButton: {
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 5,
    minWidth: 60,
    alignItems: 'center',
  },
  toolbarButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  subtitlePickerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitlePicker: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 20,
    minWidth: 300,
    maxHeight: '70%',
  },
  subtitlePickerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  subtitleOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  subtitleOptionSelected: {
    backgroundColor: '#FF6B6B',
  },
  subtitleOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  subtitleOptionTextSelected: {
    fontWeight: 'bold',
  },
  subtitleCloseButton: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#333',
    borderRadius: 5,
    alignItems: 'center',
  },
  subtitleCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});