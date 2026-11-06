"use client";

import { useTransition } from "react";
import { cancelBooking } from "../book/actions";

export function CancelButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-[13px] text-dim hover:text-red"
      onClick={() => {
        if (confirm("Cancel this request?")) startTransition(() => cancelBooking(id));
      }}
    >
      {pending ? "Cancelling…" : "Cancel"}
    </button>
  );
}
