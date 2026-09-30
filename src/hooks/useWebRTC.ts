"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaDevices } from "./useMediaDevices";

const rtcConfiguration: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useWebRTC(onIceCandidate: (candidate: RTCIceCandidateInit) => void) {
  const media = useMediaDevices();
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const onIceRef = useRef(onIceCandidate);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const cameraTrack = useRef<MediaStreamTrack | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  onIceRef.current = onIceCandidate;

  const start = useCallback(async () => {
    if (!peerRef.current) {
      const peer = new RTCPeerConnection(rtcConfiguration);
      peer.onicecandidate = (event) => {
        if (event.candidate) onIceRef.current(event.candidate.toJSON());
      };
      peer.ontrack = (event) => {
        setRemoteStream(event.streams[0] ?? new MediaStream([event.track]));
      };
      peer.onconnectionstatechange = () => setConnectionState(peer.connectionState);
      peerRef.current = peer;
    }
    const stream = await media.start();
    const peer = peerRef.current;
    if (peer && peer.getSenders().length === 0) {
      stream.getTracks().forEach((track) => {
        if (track.kind === "video") cameraTrack.current = track;
        peer.addTrack(track, stream);
      });
    }
    return peerRef.current;
  }, [media.start]);

  const createOffer = useCallback(async () => {
    const peer = await start();
    if (!peer) throw new Error("Peer connection could not be initialized");
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    return offer;
  }, [start]);

  const answerOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    const peer = await start();
    if (!peer) throw new Error("Peer connection could not be initialized");
    await peer.setRemoteDescription(offer);
    for (const candidate of pendingCandidates.current.splice(0)) {
      await peer.addIceCandidate(candidate);
    }
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    return answer;
  }, [start]);

  const acceptAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const peer = peerRef.current;
    if (!peer) throw new Error("Peer connection is not initialized");
    await peer.setRemoteDescription(answer);
    for (const candidate of pendingCandidates.current.splice(0)) {
      await peer.addIceCandidate(candidate);
    }
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const peer = peerRef.current;
    if (!peer || !peer.remoteDescription) {
      pendingCandidates.current.push(candidate);
      return;
    }
    await peer.addIceCandidate(candidate);
  }, []);

  const toggleAudio = useCallback(() => {
    const next = !audioEnabled;
    media.streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = next; });
    setAudioEnabled(next);
  }, [audioEnabled, media.streamRef]);

  const toggleVideo = useCallback(() => {
    const next = !videoEnabled;
    media.streamRef.current?.getVideoTracks().forEach((track) => { track.enabled = next; });
    setVideoEnabled(next);
  }, [videoEnabled, media.streamRef]);

  const shareScreen = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer) throw new Error("Peer connection is not initialized");
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = display.getVideoTracks()[0];
    const sender = peer.getSenders().find((item) => item.track?.kind === "video");
    await sender?.replaceTrack(screenTrack);
    screenTrack.onended = () => {
      if (cameraTrack.current) void sender?.replaceTrack(cameraTrack.current);
    };
  }, []);

  const close = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    pendingCandidates.current = [];
    media.stop();
  }, [media.stop]);

  useEffect(() => close, [close]);

  return {
    localStream: media.localStream,
    remoteStream,
    mediaError: media.error,
    connectionState,
    audioEnabled,
    videoEnabled,
    start,
    createOffer,
    answerOffer,
    acceptAnswer,
    addIceCandidate,
    toggleAudio,
    toggleVideo,
    shareScreen,
    close,
  };
}
