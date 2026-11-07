"use client";

import { useActionState } from "react";
import { saveContest } from "../actions";

// <input type="datetime-local"> wants local time without a zone.
function toLocalInput(iso: string | undefined, fallbackDays = 0) {
  const d = iso ? new Date(iso) : new Date(Date.now() + fallbackDays * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ContestForm({ contest }: { contest: { id: string; title: string; prize: string; starts_at: string; ends_at: string } | null }) {
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof saveContest>>, formData: FormData) => {
    // Convert the local datetime inputs to absolute times in this browser's zone.
    for (const key of ["starts_at", "ends_at"]) {
      const value = String(formData.get(key) ?? "");
      if (value) formData.set(key, new Date(value).toISOString());
    }
    return saveContest(prev, formData);
  }, undefined);

  return (
    <form action={action} className="card flex flex-col gap-4 p-6">
      <h2 className="eyebrow">{contest ? "Edit contest" : "New contest"}</h2>
      {contest && <input type="hidden" name="id" value={contest.id} />}
      <label className="label">
        Title
        <input className="field" name="title" defaultValue={contest?.title ?? ""} placeholder="e.g. December Short-Field Challenge" required />
      </label>
      <label className="label">
        Prize
        <input className="field" name="prize" defaultValue={contest?.prize ?? ""} placeholder="e.g. A free 1-hour 1-on-1 Zoom lesson" required />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">
          Starts
          <input className="field" type="datetime-local" name="starts_at" defaultValue={toLocalInput(contest?.starts_at)} required />
        </label>
        <label className="label">
          Ends
          <input className="field" type="datetime-local" name="ends_at" defaultValue={toLocalInput(contest?.ends_at, 30)} required />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? "Saving…" : contest ? "Save" : "Create contest"}
        </button>
        {state?.error && <span className="text-[14px] text-red">{state.error}</span>}
        {state?.message && <span className="text-[14px] text-green">{state.message}</span>}
      </div>
    </form>
  );
}
