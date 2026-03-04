import { useState, useCallback, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export function useFfmpeg() {
  const [loaded, setLoaded] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const [progress, setProgress] = useState(0);

  const load = useCallback(async () => {
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    const ffmpeg = ffmpegRef.current;
    
    ffmpeg.on("progress", ({ progress }) => {
      setProgress(progress);
    });

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    setLoaded(true);
  }, []);

  const trimVideo = useCallback(async (url: string, start: number, duration: number) => {
    if (!loaded) await load();
    
    const ffmpeg = ffmpegRef.current;
    const inputName = "input.mp4";
    const outputName = "output.mp4";

    await ffmpeg.writeFile(inputName, await fetchFile(url));

    // Simple trim: -ss (start), -t (duration), -c copy (fast, no re-encoding)
    // Note: -ss before -i is faster but might be less accurate (keyframe based).
    // Using -ss after -i for better accuracy in preview.
    await ffmpeg.exec([
      "-i", inputName,
      "-ss", start.toString(),
      "-t", duration.toString(),
      "-c", "copy",
      outputName
    ]);

    const data = await ffmpeg.readFile(outputName);
    // Use .slice().buffer to ensure we have a standard ArrayBuffer if SharedArrayBuffer is used
    const blob = new Blob([(data as Uint8Array).slice().buffer], { type: "video/mp4" });
    return URL.createObjectURL(blob);
  }, [loaded, load]);

  return {
    loaded,
    load,
    progress,
    trimVideo
  };
}
