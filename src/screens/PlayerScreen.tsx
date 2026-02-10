import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  Text,
  TouchableOpacity,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import Slider from "@react-native-community/slider";
import * as ScreenOrientation from "expo-screen-orientation";
import * as NavigationBar from "expo-navigation-bar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Audio } from 'expo-av';
import PrefersHomeIndicatorAutoHidden from 'react-native-home-indicator';

interface SubtitleOption {
  title: string;
  language: string;
  uri: string;
}

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

type RootStackParamList = {
  Player: {
    videoUrl: string;
    title?: string;
    subtitles?: SubtitleOption[];
  };
};

type PlayerNavigationProp = NativeStackNavigationProp<RootStackParamList, "Player">;
type PlayerRouteProp = RouteProp<RootStackParamList, "Player">;

type Props = {
  navigation: PlayerNavigationProp;
  route: PlayerRouteProp;
};

export const PlayerScreen: React.FC<Props> = ({ navigation, route }) => {
  const { videoUrl, subtitles = [] } = route.params;
  const [hideIndicator, setHideIndicator] = useState(false);

  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [selectedSubIndex, setSelectedSubIndex] = useState<number>(-1);
  const [showSubMenu, setShowSubMenu] = useState(false);

  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);
  
  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = false;
    player.timeUpdateEventInterval = 0.1;
    player.play();
  });

  useEffect(() => {
    // Start with indicator visible
    setHideIndicator(false);
    
    // Hide after 3 seconds
    const timer = setTimeout(() => {
      setHideIndicator(true);
    }, 3000);

    return () => {
      clearTimeout(timer);
      setHideIndicator(false);
    };
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });
  }, []);

  const timeUpdate = useEvent(player, "timeUpdate");
  const { isPlaying: playerIsPlaying } = useEvent(player, 'playingChange', { 
    isPlaying: player.playing 
  });

  useEffect(() => {
    if (timeUpdate?.currentTime !== undefined && !isSeeking) {
      setCurrentTime(timeUpdate.currentTime);
    }
  }, [timeUpdate, isSeeking]);

  useEffect(() => {
  if (timeUpdate?.currentTime !== undefined && !isSeeking) {
      setCurrentTime(timeUpdate.currentTime);
    }
  }, [timeUpdate, isSeeking]);

  useEffect(() => {
    if (player.duration) {
      setDuration(player.duration);
    }
  }, [player.duration]);

  useEffect(() => {
    (async () => {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      StatusBar.setHidden(true);
      if (Platform.OS === "android") {
        await NavigationBar.setVisibilityAsync("hidden");
        await NavigationBar.setBehaviorAsync("overlay-swipe");
      }
    })();

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      StatusBar.setHidden(false);
      if (Platform.OS === "android") {
        NavigationBar.setVisibilityAsync("visible");
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", async () => {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      StatusBar.setHidden(false);
      if (Platform.OS === "android") {
        await NavigationBar.setVisibilityAsync("visible");
      }
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (selectedSubIndex >= 0 && subtitles[selectedSubIndex]) {
      loadSubtitleFile(subtitles[selectedSubIndex].uri);
    } else {
      setSubtitleCues([]);
      setCurrentSubtitle("");
    }
  }, [selectedSubIndex, subtitles]);

  useEffect(() => {
    if (controlsVisible) {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
      
      hideControlsTimer.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }

    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, [controlsVisible]);

  useEffect(() => {
    const activeCue = subtitleCues.find(
      (cue) => currentTime >= cue.start && currentTime <= cue.end
    );
    setCurrentSubtitle(activeCue ? activeCue.text : "");
  }, [currentTime, subtitleCues]);

  const loadSubtitleFile = async (uri: string) => {
    try {
      const response = await fetch(uri);
      const text = await response.text();
      const cues = parseSubtitles(text);
      setSubtitleCues(cues);
    } catch (error) {
      console.error("Failed to load subtitles:", error);
      setSubtitleCues([]);
      setCurrentSubtitle("");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleScreenTap = () => {
    setControlsVisible(!controlsVisible);
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    setIsPlaying(!isPlaying);
  };

  const skipBackward = () => {
    const newTime = Math.max(0, currentTime - 10);
    player.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skipForward = () => {
    const newTime = Math.min(duration, currentTime + 10);
    player.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSliderStart = () => {
    setIsSeeking(true);
  };

  const handleSliderChange = (value: number) => {
    setCurrentTime(value);
  };

  const handleSliderComplete = (value: number) => {
    player.currentTime = value;
    setCurrentTime(value);
    setIsSeeking(false);
  };

  const handleExit = () => {
    navigation.goBack();
  };

  const subtitleOptions = [
    { title: "Off", language: "off", uri: "" },
    ...subtitles,
  ];

  return (
    <View style={styles.container}>
      {hideIndicator && <PrefersHomeIndicatorAutoHidden />}
      <VideoView
        player={player}
        style={styles.video}
        allowsFullscreen
        allowsPictureInPicture
        contentFit="contain"
        nativeControls={false}
      />

      {/* Full screen tap area */}
      <Pressable 
        style={styles.tapArea} 
        onPress={handleScreenTap}
      />

      {/* Top controls */}
      {controlsVisible && (
        <>
          <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
            <Text style={styles.exitText}>✕</Text>
          </TouchableOpacity>

          {subtitles.length > 0 && (
            <TouchableOpacity
              style={styles.ccButton}
              onPress={() => setShowSubMenu(!showSubMenu)}
            >
              <Text style={styles.ccText}>CC</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Center playback controls */}
      {controlsVisible && (
        <View style={styles.centerControls}>
          <TouchableOpacity style={styles.controlButton} onPress={skipBackward}>
            <Text style={styles.controlButtonText}>‹‹</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.playPauseButton} onPress={togglePlayPause}>
            <Text style={styles.playPauseText}>{isPlaying ? "❚❚" : "▶"}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton} onPress={skipForward}>
            <Text style={styles.controlButtonText}>››</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom controls bar */}
      {controlsVisible && (
        <View style={styles.controlsBar}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          
          <Slider
            style={styles.slider}
            value={currentTime}
            minimumValue={0}
            maximumValue={duration || 1}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="rgba(255,255,255,0.3)"
            thumbTintColor="#fff"
            onSlidingStart={handleSliderStart}
            onValueChange={handleSliderChange}
            onSlidingComplete={handleSliderComplete}
          />
          
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      )}

      {/* Subtitles */}
      {currentSubtitle !== "" && (
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitleText}>{currentSubtitle}</Text>
        </View>
      )}

      {/* Subtitle menu */}
      {showSubMenu && (
        <View style={styles.menu}>
          <Text style={styles.menuTitle}>Subtitles</Text>
          <ScrollView style={styles.menuScroll}>
            {subtitleOptions.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuItem,
                  selectedSubIndex === index - 1 && styles.menuItemActive,
                ]}
                onPress={() => {
                  setSelectedSubIndex(index - 1);
                  setShowSubMenu(false);
                  setControlsVisible(true);
                }}
              >
                <Text style={styles.menuItemText}>{item.title}</Text>
                {selectedSubIndex === index - 1 && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const parseSubtitles = (content: string): SubtitleCue[] => {
  const cues: SubtitleCue[] = [];
  const lines = content.trim().split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line.includes("-->")) {
      const [startStr, endStr] = line.split("-->").map((s) => s.trim());
      const start = parseVTTTimestamp(startStr);
      const end = parseVTTTimestamp(endStr);
      
      i++;
      let text = "";
      
      while (i < lines.length && lines[i].trim() !== "") {
        text += (text ? "\n" : "") + lines[i].trim();
        i++;
      }
      
      cues.push({ start, end, text });
    }
    
    i++;
  }

  return cues;
};

const parseVTTTimestamp = (timestamp: string): number => {
  try {
    const parts = timestamp.split(":");
    let hours = 0, minutes = 0, seconds = 0;

    if (parts.length === 3) {
      hours = parseInt(parts[0]) || 0;
      minutes = parseInt(parts[1]) || 0;
      seconds = parseFloat(parts[2]) || 0;
    } else if (parts.length === 2) {
      minutes = parseInt(parts[0]) || 0;
      seconds = parseFloat(parts[1]) || 0;
    }

    return hours * 3600 + minutes * 60 + seconds;
  } catch {
    return 0;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  video: {
    flex: 1,
  },

  // Tap area
  tapArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 80,
    zIndex: 1,
  },

  // Top buttons
  exitButton: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  exitText: {
    color: "#fff",
    fontSize: 20,
  },
  ccButton: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 10,
  },
  ccText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  // Center controls
  centerControls: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -90 }, { translateY: -25 }],
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    zIndex: 10,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
  },
  playPauseButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  playPauseText: {
    color: "#fff",
    fontSize: 24,
  },

  // Bottom controls
  controlsBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 10,
  },
  timeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
    minWidth: 40,
  },
  slider: {
    flex: 1,
    marginHorizontal: 12,
    height: 40,
  },

  // Subtitles
  subtitleContainer: {
    position: "absolute",
    bottom: 70,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 5,
  },
  subtitleText: {
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.75)",
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    textAlign: "center",
  },

  // Menu
  menu: {
    position: "absolute",
    top: 60,
    right: 16,
    backgroundColor: "rgba(28,28,30,0.95)",
    borderRadius: 12,
    width: 200,
    maxHeight: 300,
    padding: 12,
    zIndex: 20,
  },
  menuTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  menuScroll: {
    maxHeight: 250,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  menuItemActive: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  menuItemText: {
    color: "#fff",
    fontSize: 14,
  },
  checkmark: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "bold",
  },
});