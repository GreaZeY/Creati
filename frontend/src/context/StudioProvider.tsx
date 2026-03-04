import React, { createContext, useContext, useState, useCallback } from "react";
import type { OverlayItem } from "../components/video/VideoEditorModal";

export interface AudioTrackItem {
  id: string;
  name: string;
  url: string;
  startTime: number;
  duration: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export interface TransitionItem {
  id: string;
  type: "fade" | "zoom" | "slide" | "glitch";
  timestamp: number;
  duration: number;
}

export interface StudioState {
  video: {
    id: string;
    url: string;
    trimStart: number;
    trimEnd: number;
    duration: number;
    volume: number;
  };
  audioTracks: AudioTrackItem[];
  overlays: OverlayItem[];
  transitions: TransitionItem[];
  currentTime: number;
  isPlaying: boolean;
  selectedElementId: string | null;
}

interface StudioContextType {
  state: StudioState;
  updateVideo: (updates: Partial<StudioState["video"]>) => void;
  addAudioTrack: (audio: Omit<AudioTrackItem, "id">) => void;
  updateAudioTrack: (id: string, updates: Partial<AudioTrackItem>) => void;
  removeAudioTrack: (id: string) => void;
  addOverlay: (overlay: OverlayItem) => void;
  updateOverlay: (id: string, updates: Partial<OverlayItem>) => void;
  removeOverlay: (id: string) => void;
  addTransition: (transition: Omit<TransitionItem, "id">) => void;
  removeTransition: (id: string) => void;
  setCurrentTime: (time: number) => void;
  togglePlayback: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
  selectElement: (id: string | null) => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

export const StudioProvider: React.FC<{
  initialVideo: { id: string; url: string; duration: number };
  children: React.ReactNode;
}> = ({ initialVideo, children }) => {
  const [state, setState] = useState<StudioState>({
    video: {
      ...initialVideo,
      trimStart: 0,
      trimEnd: initialVideo.duration,
      volume: 1,
    },
    audioTracks: [],
    overlays: [],
    transitions: [],
    currentTime: 0,
    isPlaying: false,
    selectedElementId: null,
  });

  const togglePlayback = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const setCurrentTime = useCallback((time: number) => {
    setState((prev) => ({ ...prev, currentTime: time }));
  }, []);

  const updateVideo = useCallback((updates: Partial<StudioState["video"]>) => {
    setState((prev) => ({
      ...prev,
      video: { ...prev.video, ...updates },
    }));
  }, []);

  const addAudioTrack = useCallback((audio: Omit<AudioTrackItem, "id">) => {
    const id = `audio-${Date.now()}`;
    setState((prev) => ({
      ...prev,
      audioTracks: [...prev.audioTracks, { ...audio, id }],
    }));
  }, []);

  const updateAudioTrack = useCallback(
    (id: string, updates: Partial<AudioTrackItem>) => {
      setState((prev) => ({
        ...prev,
        audioTracks: prev.audioTracks.map((track) =>
          track.id === id ? { ...track, ...updates } : track,
        ),
      }));
    },
    [],
  );

  const removeAudioTrack = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      audioTracks: prev.audioTracks.filter((track) => track.id !== id),
    }));
  }, []);

  const addOverlay = useCallback((overlay: OverlayItem) => {
    setState((prev) => ({
      ...prev,
      overlays: [...prev.overlays, overlay],
      selectedElementId: overlay.id,
    }));
  }, []);

  const updateOverlay = useCallback(
    (id: string, updates: Partial<OverlayItem>) => {
      setState((prev) => ({
        ...prev,
        overlays: prev.overlays.map((ov) =>
          ov.id === id ? { ...ov, ...updates } : ov,
        ),
      }));
    },
    [],
  );

  const removeOverlay = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      overlays: prev.overlays.filter((ov) => ov.id !== id),
      selectedElementId:
        prev.selectedElementId === id ? null : prev.selectedElementId,
    }));
  }, []);

  const addTransition = useCallback(
    (transition: Omit<TransitionItem, "id">) => {
      const id = `trans-${Date.now()}`;
      setState((prev) => ({
        ...prev,
        transitions: [...prev.transitions, { ...transition, id }],
      }));
    },
    [],
  );

  const removeTransition = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      transitions: prev.transitions.filter((t) => t.id !== id),
    }));
  }, []);

  const setIsPlaying = useCallback((isPlaying: boolean) => {
    setState((prev) => ({ ...prev, isPlaying }));
  }, []);

  const selectElement = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, selectedElementId: id }));
  }, []);

  return (
    <StudioContext.Provider
      value={{
        state,
        updateVideo,
        addAudioTrack,
        updateAudioTrack,
        removeAudioTrack,
        addOverlay,
        updateOverlay,
        removeOverlay,
        addTransition,
        removeTransition,
        setCurrentTime,
        togglePlayback,
        setIsPlaying,
        selectElement,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
};

export const useStudio = () => {
  const context = useContext(StudioContext);
  if (!context)
    throw new Error("useStudio must be used within a StudioProvider");
  return context;
};
