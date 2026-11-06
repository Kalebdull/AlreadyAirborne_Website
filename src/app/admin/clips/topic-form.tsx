"use client";

import { useActionState, useTransition } from "react";
import { createTopic, deleteTopic } from "../actions";

export function TopicForm() {
  const [state, action, pending] = useActionState(createTopic, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border-t border-line pt-8">
      <label className="label flex-1">
        New topic
        <input className="field" name="name" placeholder="e.g. Systems" required />
      </label>
      <button type="submit" className="btn btn-ghost" disabled={pending}>
        Add topic
      </button>
      {state?.error && <span className="w-full text-[14px] text-red">{state.error}</span>}
      {state?.message && <span className="w-full text-[14px] text-green">{state.message}</span>}
    </form>
  );
}

export function DeleteTopicButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-[13px] text-dim hover:text-red"
      onClick={() => startTransition(async () => void (await deleteTopic(id)))}
    >
      Remove topic
    </button>
  );
}
