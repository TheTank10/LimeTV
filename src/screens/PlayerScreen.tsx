import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  Text,
  TouchableOpacity,
  Platform,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import Slider from "@react-native-community/slider";
import * as ScreenOrientation from "expo-screen-orientation";
import * as NavigationBar from "expo-navigation-bar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Audio } from 'expo-av';
import { getSubtitles } from '../services/opensubtitles';

interface SubtitleOption {
  title: string;
  language: string;
  uri?: string; // Optional for backward compatibility
}

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

interface SubtitleState {
  currentIndex: number;
  totalAvailable: number;
}

type RootStackParamList = {
  Player: {
    videoUrl: string;
    title?: string;
    subtitle?: string;
    subtitles?: SubtitleOption[];
    // New params for OpenSubtitles
    tmdbId?: number;
    mediaType?: 'movie' | 'tv';
    season?: number;
    episode?: number;
  };
};

type PlayerNavigationProp = NativeStackNavigationProp<RootStackParamList, "Player">;
type PlayerRouteProp = RouteProp<RootStackParamList, "Player">;

type Props = {
  navigation: PlayerNavigationProp;
  route: PlayerRouteProp;
};

export const PlayerScreen: React.FC<Props> = ({ navigation, route }) => {
  const { 
    videoUrl, 
    subtitles = [], 
    tmdbId, 
    mediaType, 
    season, 
    episode 
  } = route.params;

  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [selectedSubIndex, setSelectedSubIndex] = useState<number>(-1);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [loadingSubtitle, setLoadingSubtitle] = useState(false);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  
  // Track subtitle state per language (for cycling)
  const [subtitleStates, setSubtitleStates] = useState<{ [languageCode: string]: SubtitleState }>({});

  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);
  const isSeekingRef = useRef(false);

  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = false;
    player.timeUpdateEventInterval = 0.1;
    player.play();
  });

  useLayoutEffect(() => {
    navigation.setOptions({ autoHideHomeIndicator: true });
  }, [navigation]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });
  }, []);

  const timeUpdate = useEvent(player, "timeUpdate");
  const { isPlaying: playerIsPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  useEffect(() => {
    if (timeUpdate?.currentTime !== undefined && !isSeekingRef.current) {
      setCurrentTime(timeUpdate.currentTime);
    }
  }, [timeUpdate]);

  useEffect(() => {
    if (player.duration) {
      setDuration(player.duration);
    }
  }, [player.duration]);

  useEffect(() => {
    setIsPlaying(playerIsPlaying);
  }, [playerIsPlaying]);

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
    if (controlsVisible && !isSeeking) {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    } else {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
        hideControlsTimer.current = null;
      }
    }
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [controlsVisible, isSeeking]);

  useEffect(() => {
    const activeCue = findActiveCue(subtitleCues, currentTime - subtitleOffset);
    setCurrentSubtitle(activeCue ? activeCue.text : "");
  }, [currentTime, subtitleCues, subtitleOffset]);

  /**
   * Load subtitle - handles cycling through multiple subtitle options
   */
  const loadSubtitle = async (subtitle: SubtitleOption, optionIndex: number) => {
    // If it has a URI, load it directly (legacy support)
    if (subtitle.uri) {
      setSelectedSubIndex(optionIndex);
      setShowSubMenu(false);
      setControlsVisible(true);
      setSubtitleOffset(0);
      loadSubtitleFile(subtitle.uri);
      return;
    }
    
    // Otherwise, fetch from OpenSubtitles
    if (!tmdbId || !mediaType) {
      console.error('Missing TMDB metadata for subtitle fetching');
      return;
    }
    
    const currentState = subtitleStates[subtitle.language];
    
    // Determine which subtitle index to fetch
    let subtitleIndex = 0;
    if (currentState) {
      // Cycle to next subtitle
      subtitleIndex = (currentState.currentIndex + 1) % currentState.totalAvailable;
    }
    
    setLoadingSubtitle(true);
    setShowSubMenu(false);
    setControlsVisible(true);
    
    try {
      const result = await getSubtitles(
        {
          tmdbId,
          language: subtitle.language,
          mediaType,
          season,
          episode,
          sortBy: 'popular', // Use popular sorting for best results
        },
        subtitleIndex
      );
      
      if (result.success && result.srtContent) {
        const cues = parseSRT(result.srtContent);
        setSubtitleCues(cues);
        setSelectedSubIndex(optionIndex);
        
        // Update subtitle state for this language
        setSubtitleStates(prev => ({
          ...prev,
          [subtitle.language]: {
            currentIndex: result.currentIndex || 0,
            totalAvailable: result.totalAvailable || 1,
          }
        }));
        
        console.log(`Loaded subtitle ${(result.currentIndex || 0) + 1}/${result.totalAvailable || 1}: ${result.releaseName}`);
      } else {
        console.error('Failed to fetch subtitles:', result.error);
        setSubtitleCues([]);
        setCurrentSubtitle("");
      }
    } catch (error) {
      console.error('Error loading subtitles:', error);
      setSubtitleCues([]);
      setCurrentSubtitle("");
    } finally {
      setLoadingSubtitle(false);
    }
  };

  const loadSubtitleFile = async (uri: string) => {
    try {
      const response = await fetch(uri);
      
      // Check if it's gzipped
      const contentType = response.headers.get('content-type') || '';
      const isGzipped = uri.endsWith('.gz') || contentType.includes('gzip');
      
      let text: string;
      
      if (isGzipped) {
        const arrayBuffer = await response.arrayBuffer();
        const pako = require('pako');
        const compressed = new Uint8Array(arrayBuffer);
        const decompressed = pako.ungzip(compressed);
        const textDecoder = new TextDecoder('utf-8');
        text = textDecoder.decode(decompressed);
      } else {
        text = await response.text();
      }
      
      const cues = parseSRT(text);
      setSubtitleCues(cues);
    } catch (error) {
      console.error("Failed to load subtitles:", error);
      setSubtitleCues([]);
      setCurrentSubtitle("");
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatRemainingTime = (current: number, total: number) => {
    const remaining = total - current;
    const hours = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    const secs = Math.floor(remaining % 60);
    if (hours > 0) {
      return `-${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `-${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleScreenTap = () => setControlsVisible((v) => !v);

  const togglePlayPause = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
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
    isSeekingRef.current = true;
    setIsSeeking(true);
  };

  const handleSliderChange = (value: number) => {
    setCurrentTime(value);
  };

  const handleSliderComplete = (value: number) => {
    player.currentTime = value;
    player.play();
    setTimeout(() => {
      isSeekingRef.current = false;
      setIsSeeking(false);
    }, 200);
  };

  const handleExit = () => navigation.goBack();

  const handleSubtitleOffClick = () => {
    setSelectedSubIndex(-1);
    setSubtitleCues([]);
    setCurrentSubtitle("");
    setShowSubMenu(false);
    setControlsVisible(true);
    setSubtitleOffset(0);
  };

  const subtitleOptions = [
    { title: "Off", language: "off", uri: "" },
    ...subtitles,
  ];

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        allowsFullscreen
        allowsPictureInPicture
        contentFit="contain"
        nativeControls={false}
      />

      <Pressable style={styles.tapArea} onPress={handleScreenTap} />

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

      {controlsVisible && (
        <View style={styles.centerControls}>
          <TouchableOpacity style={styles.controlButton} onPress={skipBackward}>
            <Image
              source={require('../../assets/rewind.png')}
              style={styles.skipIcon}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.playPauseButton} onPress={togglePlayPause}>
            <Image
              source={isPlaying ? require('../../assets/pause.png') : require('../../assets/play.png')}
              style={styles.playPauseIcon}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={skipForward}>
            <Image
              source={require('../../assets/skip.png')}
              style={styles.skipIcon}
            />
          </TouchableOpacity>
        </View>
      )}

      {controlsVisible && (
        <View style={styles.controlsBar}>
          <Slider
            style={styles.slider}
            value={currentTime}
            minimumValue={0}
            maximumValue={duration || 1}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="rgba(255,255,255,0.3)"
            thumbTintColor="transparent"
            onSlidingStart={handleSliderStart}
            onValueChange={handleSliderChange}
            onSlidingComplete={handleSliderComplete}
            tapToSeek={true}
          />
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <Text style={styles.timeText}>{formatRemainingTime(currentTime, duration)}</Text>
          </View>
        </View>
      )}

      {currentSubtitle !== "" && (
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitleText}>{currentSubtitle}</Text>
        </View>
      )}

      {loadingSubtitle && (
        <View style={styles.loadingSubtitleOverlay}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingSubtitleText}>Loading subtitles...</Text>
        </View>
      )}

      {showSubMenu && (
        <View style={styles.menu}>
          <Text style={styles.menuTitle}>Subtitles</Text>
          <ScrollView style={styles.menuScroll}>
            {subtitleOptions.map((item, index) => {
              const optionIndex = index - 1; // Adjust for "Off" option
              const isSelected = selectedSubIndex === optionIndex;
              const state = subtitleStates[item.language];
              
              // Build display title with subtitle count
              let displayTitle = item.title;
              if (isSelected && state && state.totalAvailable > 1) {
                displayTitle = `${item.title} (${state.currentIndex + 1}/${state.totalAvailable})`;
              }
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.menuItem,
                    isSelected && styles.menuItemActive,
                  ]}
                  onPress={() => {
                    if (index === 0) {
                      // "Off" option
                      handleSubtitleOffClick();
                    } else {
                      // Language option - cycle through subtitles
                      loadSubtitle(item, optionIndex);
                    }
                  }}
                >
                  <Text style={styles.menuItemText}>{displayTitle}</Text>
                  {isSelected && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
            
            {selectedSubIndex !== -1 && (
              <View style={styles.offsetContainer}>
                <View style={styles.offsetHeader}>
                  <Text style={styles.offsetLabel}>Sync</Text>
                  <Text style={styles.offsetValue}>
                    {subtitleOffset > 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s
                  </Text>
                </View>
                <Slider
                  style={styles.offsetSlider}
                  value={subtitleOffset}
                  minimumValue={-30}
                  maximumValue={30}
                  step={0.5}
                  minimumTrackTintColor="#4CAF50"
                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                  thumbTintColor="transparent"
                  onValueChange={(value) => setSubtitleOffset(value)}
                />
                <View style={styles.offsetMarkers}>
                  <Text style={styles.offsetMarkerText}>-30s</Text>
                  <Text style={styles.offsetMarkerText}>0</Text>
                  <Text style={styles.offsetMarkerText}>+30s</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const findActiveCue = (cues: SubtitleCue[], time: number): SubtitleCue | undefined => {
  let lo = 0;
  let hi = cues.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const cue = cues[mid];

    if (cue.end < time) {
      lo = mid + 1;
    } else if (cue.start > time) {
      hi = mid - 1;
    } else {
      return cue;
    }
  }

  return undefined;
};

const parseSRT = (content: string): SubtitleCue[] => {
  const cues: SubtitleCue[] = [];

  const lines = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .split("\n");

  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line === "" || /^\d+$/.test(line)) {
      i++;
      continue;
    }

    if (line.includes("-->")) {
      const [startStr, endStr] = line.split("-->").map((s) => s.trim());
      const start = parseSRTTimestamp(startStr);
      const end = parseSRTTimestamp(endStr);

      i++;

      while (i < lines.length && lines[i].trim() === "") {
        i++;
      }

      const textLines: string[] = [];

      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i].trim());
        i++;
      }

      const text = textLines.join("\n").replace(/<[^>]*>/g, "").trim();

      if (text) {
        cues.push({ start, end, text });
      }

      continue;
    }

    i++;
  }

  cues.sort((a, b) => a.start - b.start);

  return cues;
};

const parseSRTTimestamp = (timestamp: string): number => {
  try {
    const normalized = timestamp.trim().replace(",", ".");
    const parts = normalized.split(":");

    let hours = 0, minutes = 0, seconds = 0;

    if (parts.length === 3) {
      hours   = parseInt(parts[0], 10) || 0;
      minutes = parseInt(parts[1], 10) || 0;
      seconds = parseFloat(parts[2])   || 0;
    } else if (parts.length === 2) {
      minutes = parseInt(parts[0], 10) || 0;
      seconds = parseFloat(parts[1])   || 0;
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
  tapArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 80,
    zIndex: 1,
  },
  exitButton: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  exitText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "300",
  },
  ccButton: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 10,
  },
  ccText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  centerControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 30,
    zIndex: 10,
    pointerEvents: 'box-none',
  },
  controlButton: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  playPauseButton: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  playPauseIcon: {
    width: 32,
    height: 32,
    tintColor: '#fff',
  },
  skipIcon: {
    width: 28,
    height: 28,
    tintColor: '#fff',
  },
  controlsBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "rgba(0,0,0,0)",
    zIndex: 10,
  },
  slider: {
    flex: 1,
    height: 10,
    marginBottom: 8,
    transform: [{ scaleY: 1.2 }],
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
    fontVariant: ['tabular-nums'],
  },
  subtitleContainer: {
    position: "absolute",
    bottom: 30,
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
  loadingSubtitleOverlay: {
    position: "absolute",
    bottom: 120,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 15,
    gap: 8,
  },
  loadingSubtitleText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
  menu: {
    position: "absolute",
    top: 60,
    right: 16,
    backgroundColor: "rgba(28,28,30,0.95)",
    borderRadius: 12,
    width: 220,
    maxHeight: 400,
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
    maxHeight: 350,
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
  offsetContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  offsetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  offsetLabel: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "500",
  },
  offsetValue: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ['tabular-nums'],
  },
  offsetSlider: {
    width: '100%',
    height: 30,
  },
  offsetMarkers: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  offsetMarkerText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});