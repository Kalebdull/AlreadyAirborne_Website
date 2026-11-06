"use client";

import { useState, useTransition } from "react";
import type { BookingStatus } from "@/lib/data";
import { cancelBookingAsAdmin, clearBooking, declineBooking, setPaid, type AdminState } from "./actions";

export function BookingActions({
  id,
  status,
  paid,
  past,
}: {
  id: string;
  status: BookingStatus;
  paid: boolean;
  past: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<AdminState>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
    });
  }

  if (declining) {
    return (
      <div className="flex w-full max-w-[360px] flex-col gap-2">
        <input
          className="field !py-2.5 !text-[15px]"
          placeholder="Optional note to the student"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm bg-red/15 text-red" disabled={pending} onClick={() => run(() => declineBooking(id, note))}>
            Send UNABLE
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeclining(false)}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {status === "pending" && (
          <>
            <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => clearBooking(id))}>
              Clear
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setDeclining(true)}>
              Unable
            </button>
          </>
        )}
        {status === "cleared" && (
          <button
            type="button"
            className={`btn btn-sm ${paid ? "btn-ghost" : "bg-green/15 text-green"}`}
            disabled={pending}
            onClick={() => run(() => setPaid(id, !paid))}
          >
            {paid ? "Mark unpaid" : "Mark paid"}
          </button>
        )}
        {status === "cleared" && !past && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pending}
            onClick={() => {
              if (confirm("Cancel this cleared session? The student will see it as cancelled.")) run(() => cancelBookingAsAdmin(id));
            }}
          >
            Cancel
          </button>
        )}
      </div>
      {error && <span className="max-w-[320px] text-right text-[13px] text-red">{error}</span>}
    </div>
  );
}
