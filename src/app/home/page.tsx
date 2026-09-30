"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  authenticateLocalTestUser,
  createCall,
  getCallHistory,
  isLocalTestAuthBypassEnabled,
  joinCall,
  rejectCall as rejectCallApi,
} from "@/lib/api";
import { useSession } from "@/lib/session";
import { useSignaling, type SignalMessage } from "@/hooks/useSignaling";

export default function HomePage() {
  const router = useRouter();
  const session = useSession((state) => state.session);
  const incomingCall = useSession((state) => state.incomingCall);
  const setIncomingCall = useSession((state) => state.setIncomingCall);
  const setSession = useSession((state) => state.setSession);
  const [calleeId, setCalleeId] = useState("");
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getCallHistory>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onMessage = useCallback((message: SignalMessage) => {
    if (message.type === "CALL_REQUEST") {
      setIncomingCall({ callId: message.callId, senderId: message.senderId });
    }
  }, [setIncomingCall]);
  const { send, connected } = useSignaling(onMessage);

  useEffect(() => {
    if (!session) {
      if (!isLocalTestAuthBypassEnabled()) {
        router.replace("/login");
        return;
      }
      let cancelled = false;
      void authenticateLocalTestUser().then((localSession) => {
        if (!cancelled) setSession(localSession);
      }).catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not create a local test account");
      });
      return () => { cancelled = true; };
    }
    void getCallHistory(session.token).then(setHistory).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Could not load call history");
    });
  }, [router, session, setSession]);

  async function startCall() {
    if (!session || !connected) return;
    setBusy(true);
    setError(null);
    try {
      const call = await createCall(session.token, calleeId.trim());
      send({
        type: "CALL_REQUEST",
        callId: call.id,
        recipientId: call.calleeId,
        payload: {},
      });
      router.push(`/call/${call.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the call");
    } finally {
      setBusy(false);
    }
  }

  async function acceptCall() {
    if (!session || !incomingCall) return;
    setBusy(true);
    setError(null);
    try {
      await joinCall(session.token, incomingCall.callId);
      router.push(`/call/${incomingCall.callId}`);
      setIncomingCall(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not accept the call");
    } finally {
      setBusy(false);
    }
  }

  async function rejectIncomingCall() {
    if (!session || !incomingCall || !connected) return;
    try {
      await rejectCallApi(session.token, incomingCall.callId);
      send({ type: "CALL_REJECT", callId: incomingCall.callId, recipientId: incomingCall.senderId, payload: {} });
      setIncomingCall(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reject the call");
    }
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
        <p className="text-lg font-medium">{error ? "Local test sign-in failed" : "Creating your local test account..."}</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
        {error && <a className="mt-5 text-indigo-300" href="/login">Go to login</a>}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <p className="text-sm text-indigo-300">VIDEO PLATFORM</p>
          <h1 className="mt-2 text-3xl font-semibold">Your calls</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-sm ${connected ? "text-emerald-400" : "text-amber-300"}`}>
            {connected ? "Signaling connected" : "Connecting..."}
          </span>
          <button className="text-sm text-slate-400 hover:text-white" onClick={() => { setSession(null); router.replace("/login"); }}>
            Sign out
          </button>
        </div>
      </header>

      {error && <p role="alert" className="mb-5 rounded-lg bg-red-950 p-3 text-red-300">{error}</p>}
      {incomingCall && (
        <section className="mb-8 rounded-2xl border border-indigo-400/40 bg-indigo-950/40 p-6">
          <h2 className="text-xl font-medium">Incoming video call</h2>
          <p className="mt-2 text-sm text-slate-300">Caller: {incomingCall.senderId}</p>
          <div className="mt-5 flex gap-3">
            <button disabled={busy} onClick={() => void acceptCall()} className="rounded-lg bg-emerald-600 px-5 py-2 disabled:opacity-50">Accept</button>
            <button disabled={!connected || busy} onClick={() => void rejectIncomingCall()} className="rounded-lg bg-slate-700 px-5 py-2 disabled:opacity-50">Decline</button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-medium">Start a one-to-one call</h2>
        <p className="mt-2 text-sm text-slate-400">Enter the other person's account ID to place a call.</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Recipient user ID" value={calleeId} onChange={(event) => setCalleeId(event.target.value)} />
          <button disabled={!connected || busy || !calleeId.trim()} onClick={() => void startCall()} className="rounded-lg bg-indigo-500 px-6 py-3 font-medium disabled:opacity-50">
            {busy ? "Working..." : "Start call"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Your account ID: {session.userId}</p>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-medium">Recent calls</h2>
        <div className="divide-y divide-slate-800 rounded-xl border border-slate-800">
          {history.length === 0 ? <p className="p-5 text-sm text-slate-400">No calls yet.</p> : history.map((call) => (
            <div key={call.id} className="flex items-center justify-between p-4 text-sm">
              <span className="truncate text-slate-300">{call.callerId === session.userId ? "Outgoing" : "Incoming"} · {call.id}</span>
              <span className="ml-4 text-slate-500">{call.status}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
