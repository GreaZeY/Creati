import { useState, useCallback, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export function useFfmpeg() {
  const [loaded, setLoaded] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const [progress, setProgress] = useState(0);

  const load = useCallback(async () => {
    console.log("[FFmpeg] Initializing... Cross-Origin Isolated:", window.crossOriginIsolated);
    
    if (!window.crossOriginIsolated) {
      console.warn("[FFmpeg] NOT in a Cross-Origin Isolated environment. SharedArrayBuffer might be missing, and high-performance WASM will likely fail.");
    }

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    const ffmpeg = ffmpegRef.current;
    
    ffmpeg.on("progress", ({ progress }) => {
      console.log(`[FFmpeg] Progress: ${Math.round(progress * 100)}%`);
      setProgress(progress);
    });

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      console.log("[FFmpeg] Loaded successfully");
      setLoaded(true);
    } catch (err) {
      console.error("[FFmpeg] Load failed:", err);
    }
  }, []);

  const trimVideo = useCallback(async (url: string, start: number, duration: number) => {
    console.log(`[FFmpeg] Trimming: ${url} (start: ${start}s, duration: ${duration}s)`);
    if (!loaded) {
      console.log("[FFmpeg] Not loaded, loading now...");
      await load();
    }
    
    const ffmpeg = ffmpegRef.current;
    const inputName = "input.mp4";
    const outputName = `trim_${Date.now()}.mp4`; // Unique name to avoid collisions

    try {
      console.log("[FFmpeg] Writing file...");
      await ffmpeg.writeFile(inputName, await fetchFile(url));

      console.log("[FFmpeg] Executing command...");
      // Using -preset ultrafast and -c:v libx264 for better compatibility than -c copy
      // although -c copy is faster, it can be inaccurate if -ss is not on keyframe
      await ffmpeg.exec([
        "-ss", start.toString(),
        "-i", inputName,
        "-t", duration.toString(),
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-c:a", "aac",
        outputName
      ]);

      console.log("[FFmpeg] Reading result...");
      const data = await ffmpeg.readFile(outputName);
      // Use .slice().buffer to ensure we have a standard ArrayBuffer if SharedArrayBuffer is used
      const blob = new Blob([(data as Uint8Array).slice().buffer], { type: "video/mp4" });
      const blobUrl = URL.createObjectURL(blob);
      console.log("[FFmpeg] Trim complete:", blobUrl);
      
      // Cleanup: delete files from virtual FS to save memory
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      return blobUrl;
    } catch (err) {
      console.error("[FFmpeg] Trim execution failed:", err);
      throw err;
    }
  }, [loaded, load]);
 
  return {
    loaded,
    load,
    progress,
    trimVideo
  };
}
