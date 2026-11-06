"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

type Field = {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
};

export function AuthForm({
  action,
  fields,
  submit,
  hidden,
}: {
  action: (state: FormState, data: FormData) => Promise<FormState>;
  fields: Field[];
  submit: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  if (state?.message) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-2xl bg-green/10 p-5">
        <span className="font-mono text-[11px] font-bold tracking-[.08em] text-green">ROGER</span>
        <p className="text-soft">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((f) => (
        <label key={f.name} className="label">
          {f.label}
          <input
            className="field"
            name={f.name}
            type={f.type ?? "text"}
            autoComplete={f.autoComplete}
            placeholder={f.placeholder}
            required
          />
        </label>
      ))}
      {state?.error && (
        <p role="alert" className="rounded-xl bg-red/10 px-4 py-3 text-[15px] text-red">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary mt-1 w-full" disabled={pending}>
        {pending ? "Standby…" : submit}
      </button>
    </form>
  );
}
