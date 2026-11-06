"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-32 text-center">
      <span className="font-mono text-[13px] tracking-[.14em] text-red">● MASTER CAUTION</span>
      <h1 className="headline text-[56px] md:text-[80px]">Something failed.</h1>
      <p className="max-w-[460px] text-xl text-mute">Run the checklist: try once more, and if it keeps happening, let me know.</p>
      <button type="button" onClick={reset} className="btn btn-primary">
        Try again
      </button>
    </main>
  );
}
