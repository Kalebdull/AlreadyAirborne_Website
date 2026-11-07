"use client";

import Link from "next/link";
import { useEffect, useImperativeHandle, useState, type RefObject } from "react";
import type { Result } from "./flight-model";

export type SubmitPayload = { result: Result; replay: string };
export type SubmitApi = { open: (payload: SubmitPayload) => void };

type Board = {
  contest: { title: string; prize: string; ends_at: string } | null;
  live: boolean;
  entries: { score: number }[];
  total: number;
};

type Status =
  | { kind: "form" }
  | { kind: "sending" }
  | { kind: "error"; message: string }
  | { kind: "done"; place: number | null; total: number | null; kept: boolean; score: number };

const CALLSIGN_KEY = "aa-callsign";
const EMAIL_KEY = "aa-email";

function remembered(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

// The leaderboard entry panel that opens over the flight display after a
// hand-flown landing. It has its own React state so typing never re-renders
// the flight display underneath.
export function ScoreSubmit({
  apiRef,
  holdRef,
  onClose,
}: {
  apiRef: RefObject<SubmitApi | null>;
  holdRef: RefObject<boolean>;
  onClose: (flyAgain: boolean) => void;
}) {
  const [payload, setPayload] = useState<SubmitPayload | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "form" });
  const [callsign, setCallsign] = useState("");
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [optIn, setOptIn] = useState(false);

  useImperativeHandle(apiRef, () => ({
    open(p) {
      holdRef.current = true;
      setPayload(p);
      setStatus({ kind: "form" });
      setCallsign((c) => c || remembered(CALLSIGN_KEY));
      setEmail((e) => e || remembered(EMAIL_KEY));
      fetch("/api/leaderboard")
        .then((r) => (r.ok ? r.json() : null))
        .then((b: Board | null) => setBoard(b))
        .catch(() => setBoard(null));
    },
  }));

  useEffect(() => {
    if (!payload) holdRef.current = false;
  }, [payload, holdRef]);

  if (!payload) return null;

  const score = payload.result.score;
  const wouldPlace = board ? board.entries.filter((e) => e.score >= score).length + 1 : null;

  function close(flyAgain: boolean) {
    holdRef.current = false;
    setPayload(null);
    onClose(flyAgain);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!payload) return;
    setStatus({ kind: "sending" });
    try {
      localStorage.setItem(CALLSIGN_KEY, callsign);
      localStorage.setItem(EMAIL_KEY, email);
    } catch {}
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callsign, email, agree, optIn, replay: payload.replay, claimed: payload.result.score }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "error", message: json.error ?? "Something went wrong. Try again." });
        return;
      }
      setStatus({ kind: "done", place: json.place, total: json.total, kept: json.kept, score: json.score });
    } catch {
      setStatus({ kind: "error", message: "Couldn't reach the leaderboard. Check your connection and try again." });
    }
  }

  const contest = board?.contest && board.live ? board.contest : null;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-3 text-left backdrop-blur-sm"
      onKeyDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Submit your score to the leaderboard"
    >
      <div className="flex max-h-full w-full max-w-[440px] flex-col gap-4 overflow-y-auto rounded-2xl bg-[#0b0b0c]/95 p-5 ring-1 ring-white/15 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[.16em] text-dim">{contest ? contest.title.toUpperCase() : "LEADERBOARD"}</span>
            <span className="font-display text-[40px] font-bold leading-none tracking-[-.03em] text-magenta tabular-nums">{score.toLocaleString()}</span>
            <span className="font-mono text-[11px] tracking-[.1em] text-soft">
              {payload.result.rank} · {payload.result.distance.toLocaleString()} FT
            </span>
          </div>
          {wouldPlace && status.kind !== "done" ? (
            <div className="flex flex-col items-end rounded-xl bg-white/5 px-3 py-2 font-mono">
              <span className="text-[10px] tracking-[.12em] text-dim">WOULD PLACE</span>
              <span className="text-2xl font-bold text-cyan">#{wouldPlace}</span>
            </div>
          ) : null}
        </div>

        {contest && (
          <p className="rounded-xl bg-cyan/10 px-3 py-2 text-[13px] leading-snug text-soft">
            Top score when the contest ends on{" "}
            <strong className="text-ink">
              {new Date(contest.ends_at).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
            </strong>{" "}
            wins <strong className="text-ink">{contest.prize}</strong>.
          </p>
        )}

        {status.kind === "done" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px] tracking-[.14em] text-green">● VERIFIED</span>
              <span className="font-display text-2xl font-semibold">
                {status.kept
                  ? `Your best of ${status.score.toLocaleString()} still stands.`
                  : status.place
                    ? `You're #${status.place}${status.total ? ` of ${status.total}` : ""}.`
                    : "Score saved."}
              </span>
              <span className="text-[14px] text-mute">Fly again any time. Only your best score counts.</span>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary btn-sm flex-1" onClick={() => close(true)}>
                Fly again
              </button>
              <Link href="/leaderboard" className="btn btn-ghost btn-sm flex-1">
                Leaderboard
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="label">
              Callsign (shown publicly)
              <input
                className="field !py-2.5 !text-[15px]"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                pattern="[A-Za-z0-9 ._\-]{2,16}"
                maxLength={16}
                placeholder="e.g. Maverick"
                autoComplete="nickname"
                required
              />
            </label>
            <label className="label">
              Email (private, to contact the winner)
              <input
                className="field !py-2.5 !text-[15px]"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="flex items-start gap-2.5 text-[13px] leading-snug text-soft">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-cyan" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
              <span>
                I agree to the{" "}
                <Link href="/leaderboard/rules" target="_blank" className="link">
                  contest rules
                </Link>
                .
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-[13px] leading-snug text-soft">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-cyan" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
              <span>Email me flight tips and new videos (optional).</span>
            </label>
            {status.kind === "error" && (
              <p role="alert" className="rounded-xl bg-red/10 px-3 py-2 text-[13px] text-red">
                {status.message}
              </p>
            )}
            <div className="mt-1 flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm flex-1" disabled={status.kind === "sending"}>
                {status.kind === "sending" ? "Verifying your flight…" : "Submit score"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => close(true)}>
                Skip
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
