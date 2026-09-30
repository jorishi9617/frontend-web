"use client";

import { create } from "zustand";

export type Session = { token: string; userId: string; email: string };
export type IncomingCall = { callId: string; senderId: string };

type SessionState = {
  session: Session | null;
  incomingCall: IncomingCall | null;
  setSession: (session: Session | null) => void;
  setIncomingCall: (call: IncomingCall | null) => void;
};

export const useSession = create<SessionState>((set) => ({
  session: null,
  incomingCall: null,
  setSession: (session) => set({ session }),
  setIncomingCall: (incomingCall) => set({ incomingCall }),
}));
