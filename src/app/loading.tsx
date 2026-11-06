// "Acquiring satellites": bars fill in instead of a spinner.
export default function Loading() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-32" aria-busy="true">
      <div className="flex h-10 items-end gap-1.5" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="w-2 animate-pulse rounded-sm bg-cyan motion-reduce:animate-none"
            style={{ height: `${30 + i * 12}%`, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <span className="font-mono text-xs tracking-[.14em] text-dim" role="status">
        ACQUIRING GPS…
      </span>
    </main>
  );
}
