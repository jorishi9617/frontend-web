"use client";

import { useCallback, useRef, useState } from "react";

export function useMediaDevices() {
  const streamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;
      setLocalStream(stream);
      setError(null);
      return stream;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to access camera and microphone";
      setError(message);
      throw cause;
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLocalStream(null);
  }, []);

  return { localStream, streamRef, error, start, stop };
}
