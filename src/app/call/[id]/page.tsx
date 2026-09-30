"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { endCall, getCall, type CallRecord } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useSignaling, type SignalMessage, type SignalType } from "@/hooks/useSignaling";
import { useWebRTC } from "@/hooks/useWebRTC";

type OutboundSignal = { type: SignalType; callId: string; recipientId: string; payload: Record<string, unknown> };

function VideoView({ stream, muted, label }: { stream: MediaStream | null; muted?: boolean; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative min-h-64 overflow-hidden rounded-2xl bg-slate-900">
      <video ref={videoRef} autoPlay playsInline muted={muted} className="h-full min-h-64 w-full object-cover" />
      <span className="absolute bottom-3 left-3 rounded bg-black/60 px-3 py-1 text-sm">{label}</span>
    </div>
  );
}

export default function CallPage() {
  const params = useParams<{ id: string }>();
  const callId = params.id;
  const router = useRouter();
  const session = useSession((state) => state.session);
  const [call, setCall] = useState<CallRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const callRef = useRef<CallRecord | null>(null);
  const sessionRef = useRef(session);
  const sendRef = useRef<(message: OutboundSignal) => void>(() => undefined);
  const accepted = useRef(false);

  sessionRef.current = session;
  callRef.current = call;

  const sendIce = useCallback((candidate: RTCIceCandidateInit) => {
    const currentCall = callRef.current;
    const currentSession = sessionRef.current;
    if (!currentCall || !currentSession) return;
    const recipientId = currentCall.callerId === currentSession.userId ? currentCall.calleeId : currentCall.callerId;
    sendRef.current({ type: "ICE_CANDIDATE", callId, recipientId, payload: { candidate } });
  }, [callId]);

  const rtc = useWebRTC(sendIce);
  const onSignal = useCallback(async (message: SignalMessage) => {
    const currentCall = callRef.current;
    const currentSession = sessionRef.current;
    if (!currentCall || !currentSession || message.callId !== callId) return;
    const recipientId = message.senderId;
    try {
      if (message.type === "CALL_REJECT" || message.type === "CALL_END") {
        setEnded(true);
        rtc.close();
      } else if (message.type === "WEBRTC_OFFER") {
        const offer = message.payload.sdp as RTCSessionDescriptionInit | undefined;
        if (!offer) throw new Error("Received an invalid WebRTC offer");
        const answer = await rtc.answerOffer(offer);
        sendRef.current({ type: "WEBRTC_ANSWER", callId, recipientId, payload: { sdp: answer } });
      } else if (message.type === "WEBRTC_ANSWER") {
        const answer = message.payload.sdp as RTCSessionDescriptionInit | undefined;
        if (!answer) throw new Error("Received an invalid WebRTC answer");
        await rtc.acceptAnswer(answer);
      } else if (message.type === "ICE_CANDIDATE") {
        const candidate = message.payload.candidate as RTCIceCandidateInit | undefined;
        if (candidate) await rtc.addIceCandidate(candidate);
      } else if (message.type === "CALL_ACCEPT" && currentCall.callerId === currentSession.userId) {
        const offer = await rtc.createOffer();
        sendRef.current({ type: "WEBRTC_OFFER", callId, recipientId, payload: { sdp: offer } });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not process the signaling event");
    }
  }, [callId, rtc]);

  const { send, connected } = useSignaling(onSignal);
  sendRef.current = send;

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
    let mounted = true;
    void getCall(session.token, callId).then((result) => {
      if (mounted) setCall(result);
    }).catch((cause: unknown) => {
      if (mounted) setError(cause instanceof Error ? cause.message : "Could not load this call");
    });
    return () => { mounted = false; };
  }, [callId, router, session]);

  useEffect(() => {
    if (!call || !session || ended) return;
    void rtc.start().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Camera and microphone access is required");
    });
  }, [call, ended, rtc.start, session]);

  useEffect(() => {
    if (!call || !session || !connected || !rtc.localStream || ended) return;
    const isCallee = call.calleeId === session.userId;
    if (!isCallee || accepted.current) return;
    accepted.current = true;
    const recipientId = call.callerId;
    try {
      send({ type: "CALL_ACCEPT", callId, recipientId, payload: {} });
    } catch (cause) {
      accepted.current = false;
      setError(cause instanceof Error ? cause.message : "Could not accept the call");
    }
  }, [call, callId, connected, ended, rtc.localStream, send, session]);

  async function hangUp() {
    if (!session || !call) return;
    setEnded(true);
    const recipientId = call.callerId === session.userId ? call.calleeId : call.callerId;
    try {
      if (connected) send({ type: "CALL_END", callId, recipientId, payload: {} });
      await endCall(session.token, callId);
      rtc.close();
      router.replace("/home");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not end the call");
    }
  }

  async function toggleScreenShare() {
    try {
      await rtc.shareScreen();
      setSharing(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not share your screen");
    }
  }

  if (!session) return null;
  const connectionLabel = ended ? "Call ended" : rtc.connectionState === "connected" ? "Connected" : connected ? "Waiting for peer..." : "Connecting to signaling...";

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Video call</h1>
          <p className="mt-1 text-sm text-slate-400">{connectionLabel}</p>
        </div>
        <button onClick={() => router.replace("/home")} className="text-sm text-slate-400">Leave page</button>
      </header>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-950 p-3 text-red-300">{error}</p>}
      {rtc.mediaError && <p role="alert" className="mb-4 rounded-lg bg-amber-950 p-3 text-amber-200">Camera or microphone: {rtc.mediaError}</p>}
      <section className="grid flex-1 gap-4 md:grid-cols-2">
        <VideoView stream={rtc.remoteStream} label="Other participant" />
        <VideoView stream={rtc.localStream} muted label="You" />
      </section>
      <section className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button onClick={rtc.toggleAudio} className="rounded-lg bg-slate-800 px-5 py-3">{rtc.audioEnabled ? "Mute mic" : "Unmute mic"}</button>
        <button onClick={rtc.toggleVideo} className="rounded-lg bg-slate-800 px-5 py-3">{rtc.videoEnabled ? "Turn camera off" : "Turn camera on"}</button>
        <button onClick={() => void toggleScreenShare()} className="rounded-lg bg-slate-800 px-5 py-3">{sharing ? "Sharing screen" : "Share screen"}</button>
        <button onClick={() => void hangUp()} disabled={ended} className="rounded-lg bg-red-600 px-6 py-3 font-medium disabled:opacity-50">End call</button>
      </section>
      <p className="mt-4 text-center text-xs text-slate-500">Peer connection: {rtc.connectionState}</p>
    </main>
  );
}
