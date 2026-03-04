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

export interface VideoSegment {
  id: string;
  url: string;
  startTime: number; // Start time in the overall timeline
  duration: number; // Actual duration after trim
  trimStart: number;
  trimEnd: number;
  originalDuration: number;
  volume: number;
  filter?: string;
}

export interface TransitionItem {
  id: string;
  type: "fade" | "zoom" | "slide" | "glitch" | "wipe";
  offset: number; // Point in timeline where it begins
  duration: number;
}

export interface StudioState {
  videoSegments: VideoSegment[];
  audioTracks: AudioTrackItem[];
  overlays: OverlayItem[];
  transitions: TransitionItem[];
  currentTime: number;
  isPlaying: boolean;
  selectedElementId: string | null;
  totalDuration: number;
}

interface StudioContextType {
  state: StudioState;
  addVideoSegment: (segment: Omit<VideoSegment, "id" | "startTime">) => void;
  updateVideoSegment: (
    id: string,
    updates: Partial<VideoSegment>,
    options?: { silent?: boolean },
  ) => void;
  removeVideoSegment: (id: string) => void;
  reorderSegments: (startIndex: number, endIndex: number) => void;
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
    videoSegments: [
      {
        id: `seg-${initialVideo.id}`,
        url: initialVideo.url,
        startTime: 0,
        duration: initialVideo.duration,
        originalDuration: initialVideo.duration,
        trimStart: 0,
        trimEnd: initialVideo.duration,
        volume: 1,
      },
    ],
    audioTracks: [],
    overlays: [],
    transitions: [],
    currentTime: 0,
    isPlaying: false,
    selectedElementId: null,
    totalDuration: initialVideo.duration,
  });

  const recalculateSegments = useCallback((segments: VideoSegment[]) => {
    let currentOffset = 0;
    const updated = segments.map((seg) => {
      const newSeg = { ...seg, startTime: currentOffset };
      currentOffset += seg.duration;
      return newSeg;
    });
    return { segments: updated, totalDuration: currentOffset };
  }, []);

  const togglePlayback = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const setCurrentTime = useCallback((time: number) => {
    setState((prev) => ({ ...prev, currentTime: time }));
  }, []);

  const addVideoSegment = useCallback(
    (segmentBlueprint: Omit<VideoSegment, "id" | "startTime">) => {
      setState((prev) => {
        const id = `seg-${Date.now()}`;
        const newSegments = [
          ...prev.videoSegments,
          { ...segmentBlueprint, id, startTime: prev.totalDuration },
        ];
        return {
          ...prev,
          videoSegments: newSegments,
          totalDuration: prev.totalDuration + segmentBlueprint.duration,
        };
      });
    },
    [],
  );

  const updateVideoSegment = useCallback(
    (
      id: string,
      updates: Partial<VideoSegment>,
      options?: { silent?: boolean },
    ) => {
      setState((prev) => {
        const newSegments = prev.videoSegments.map((seg) =>
          seg.id === id ? { ...seg, ...updates } : seg,
        );

        if (options?.silent) {
          return { ...prev, videoSegments: newSegments };
        }

        const { segments: recalculated, totalDuration } =
          recalculateSegments(newSegments);
        return { ...prev, videoSegments: recalculated, totalDuration };
      });
    },
    [recalculateSegments],
  );

  const removeVideoSegment = useCallback(
    (id: string) => {
      setState((prev) => {
        const newSegments = prev.videoSegments.filter((seg) => seg.id !== id);
        const { segments: recalculated, totalDuration } =
          recalculateSegments(newSegments);
        return { ...prev, videoSegments: recalculated, totalDuration };
      });
    },
    [recalculateSegments],
  );

  const reorderSegments = useCallback(
    (startIndex: number, endIndex: number) => {
      setState((prev) => {
        const result = Array.from(prev.videoSegments);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        const { segments: recalculated, totalDuration } =
          recalculateSegments(result);
        return { ...prev, videoSegments: recalculated, totalDuration };
      });
    },
    [recalculateSegments],
  );

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
        addVideoSegment,
        updateVideoSegment,
        removeVideoSegment,
        reorderSegments,
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
