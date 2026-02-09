import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Pressable,
} from "react-native";
import { Video, ResizeMode, Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import * as ScreenOrientation from "expo-screen-orientation";
import * as NavigationBar from "expo-navigation-bar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
//import PrefersHomeIndicatorAutoHidden from 'react-native-home-indicator';

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

  const videoRef = useRef<Video>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTime = useRef(0); // 🔥 Throttle playback updates

  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [selectedSubIndex, setSelectedSubIndex] = useState<number>(-1);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    (async () => {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });
    })();
  }, []);

  useEffect(() => {
    (async () => {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      StatusBar.setHidden(true);
      if (Platform.OS === "android") {
        await NavigationBar.setVisibilityAsync("hidden");
        await NavigationBar.setBehaviorAsync("overlay-swipe");
      }
    })();
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
  }, [selectedSubIndex]);

  // Auto-hide controls after 3 seconds
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

  const handleExit = () => navigation.goBack();

  const handleScreenTap = () => {
    setControlsVisible(true);
  };

  const subtitleOptions = [
    { title: "Off", language: "off", uri: "" },
    ...subtitles,
  ];

  return (
    <View style={styles.container}>
      {/* Video with tap detection */}
      <Pressable style={styles.videoContainer} onPress={handleScreenTap}>
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.video}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          onPlaybackStatusUpdate={(status) => {
            if ("positionMillis" in status && status.positionMillis !== undefined) {
              const currentTime = Date.now();
              
              // Only update every 500ms
              if (currentTime - lastUpdateTime.current < 500) {
                return;
              }
              
              lastUpdateTime.current = currentTime;
              
              const timeSecs = status.positionMillis / 1000;
              const activeCue = subtitleCues.find(
                (cue) => timeSecs >= cue.start && timeSecs <= cue.end
              );
              setCurrentSubtitle(activeCue ? activeCue.text : "");
            }
          }}
        />
      </Pressable>

      {/* Exit Button */}
      {controlsVisible && (
        <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
          <Text style={styles.exitButtonText}>✕</Text>
        </TouchableOpacity>
      )}

      {/* Subtitle Text Overlay */}
      {currentSubtitle !== "" && (
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitleText}>{currentSubtitle}</Text>
        </View>
      )}

      {/* CC Button */}
      {controlsVisible && (
        <TouchableOpacity
          style={styles.subButton}
          onPress={() => setShowSubMenu((v) => !v)}
        >
          <Text style={styles.subButtonText}>CC</Text>
        </TouchableOpacity>
      )}

      {/* CC Menu */}
      {showSubMenu && (
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>Subtitles</Text>
          <ScrollView style={styles.menuScroll}>
            {subtitleOptions.map((item, index) => (
              <TouchableOpacity
                key={`sub-${index}`}
                style={[
                  styles.menuItem,
                  selectedSubIndex === index - 1 && styles.menuItemSelected,
                ]}
                onPress={() => {
                  console.log("Selected subtitle:", index - 1);
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
    let hours = 0,
      minutes = 0,
      seconds = 0;
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
  container: { flex: 1, backgroundColor: "#000" },
  videoContainer: { flex: 1 },
  video: { flex: 1 },

  exitButton: {
    position: "absolute",
    top: 20,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 20,
    zIndex: 10,
  },
  exitButtonText: { color: "#fff", fontSize: 24 },

  subtitleContainer: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    alignItems: "center",
  },
  subtitleText: {
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.8)",
    fontSize: 18,
    padding: 8,
    borderRadius: 6,
  },

  subButton: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 6,
    zIndex: 10,
  },
  subButtonText: { color: "#fff", fontSize: 16 },

  menuContainer: {
    position: "absolute",
    top: 60,
    right: 20,
    backgroundColor: "#222",
    padding: 12,
    borderRadius: 8,
    zIndex: 20,
    width: 200,
    maxHeight: 300,
  },
  menuTitle: { color: "#fff", marginBottom: 8, fontSize: 16, fontWeight: "bold" },
  menuScroll: { maxHeight: 220 },
  menuItem: {
    padding: 10,
    borderRadius: 6,
    marginBottom: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  menuItemSelected: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  menuItemText: { color: "#fff" },
  checkmark: { color: "#4CAF50", fontWeight: "bold" },
});