import React from "react";
import { Music, Volume2, Trash2 } from "lucide-react";
import { useStudio } from "../../context/StudioProvider";
import type { AudioTrackItem } from "../../context/StudioProvider";

interface AudioTrackComponentProps {
  track: AudioTrackItem;
  pixelsPerSecond: number;
}

export const AudioTrackComponent: React.FC<AudioTrackComponentProps> = ({
  track,
  pixelsPerSecond,
}) => {
  const { removeAudioTrack, updateAudioTrack } = useStudio();

  const width = track.duration * pixelsPerSecond;
  const left = track.startTime * pixelsPerSecond;

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateAudioTrack(track.id, { volume: parseFloat(e.target.value) });
  };

  return (
    <div
      className="absolute h-full bg-primary/20 border border-primary/30 rounded flex items-center px-3 group overflow-hidden"
      style={{ left, width }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Music size={12} className="text-primary shrink-0" />
        <span className="text-[10px] font-bold truncate text-primary/80 uppercase tracking-tighter">
          {track.name}
        </span>

        {/* Simple Simulated Waveform */}
        <div className="flex items-end gap-[1px] h-3 opacity-30 group-hover:opacity-60 transition-opacity">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="w-[2px] bg-primary rounded-full"
              style={{ height: `${Math.random() * 100}%` }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pl-2 bg-secondary/10 backdrop-blur-sm h-full">
        <div className="flex items-center gap-1">
          <Volume2 size={10} className="text-muted-foreground" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={track.volume}
            onChange={handleVolumeChange}
            className="w-12 h-1 bg-primary/20 rounded-full appearance-none accent-primary cursor-pointer"
          />
        </div>
        <button
          onClick={() => removeAudioTrack(track.id)}
          className="p-1 hover:bg-destructive/10 text-destructive rounded transition-colors"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
};
