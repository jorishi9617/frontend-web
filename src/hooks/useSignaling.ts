"use client";

import { Client, type IMessage } from "@stomp/stompjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { SIGNALING_URL } from "@/lib/config";
import { useSession } from "@/lib/session";

export type SignalType =
  | "CALL_REQUEST" | "CALL_ACCEPT" | "CALL_REJECT" | "CALL_END"
  | "WEBRTC_OFFER" | "WEBRTC_ANSWER" | "ICE_CANDIDATE";

export type SignalMessage = {
  type: SignalType;
  callId: string;
  senderId: string;
  payload: Record<string, unknown>;
};

type OutgoingSignal = Omit<SignalMessage, "senderId"> & { recipientId: string };

export function useSignaling(onMessage: (message: SignalMessage) => void) {
  const session = useSession((state) => state.session);
  const clientRef = useRef<Client | null>(null);
  const callbackRef = useRef(onMessage);
  const [connected, setConnected] = useState(false);
  callbackRef.current = onMessage;

  useEffect(() => {
    if (!session?.token) return;
    const client = new Client({
      brokerURL: SIGNALING_URL,
      connectHeaders: { Authorization: `Bearer ${session.token}` },
      reconnectDelay: 1500,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    });
    client.onConnect = () => {
      setConnected(true);
      client.subscribe("/user/queue/signaling", (frame: IMessage) => {
        callbackRef.current(JSON.parse(frame.body) as SignalMessage);
      });
    };
    client.onWebSocketClose = () => setConnected(false);
    client.onStompError = (frame) => console.error("Signaling broker error:", frame.headers.message);
    client.activate();
    clientRef.current = client;
    return () => {
      clientRef.current = null;
      setConnected(false);
      void client.deactivate();
    };
  }, [session?.token]);

  const send = useCallback((message: OutgoingSignal) => {
    const client = clientRef.current;
    if (!client?.connected) throw new Error("Signaling is not connected yet");
    client.publish({ destination: "/app/signaling", body: JSON.stringify(message) });
  }, []);

  return { send, connected };
}
