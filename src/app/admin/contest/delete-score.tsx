"use client";

import { useTransition } from "react";
import { deleteScore } from "../actions";

export function DeleteScoreButton({ id, callsign }: { id: string; callsign: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-[13px] text-dim hover:text-red"
      onClick={() => {
        if (confirm(`Remove ${callsign}'s entry from the leaderboard?`)) startTransition(async () => void (await deleteScore(id)));
      }}
    >
      Remove
    </button>
  );
}
