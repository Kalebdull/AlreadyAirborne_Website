import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-32 text-center">
      <span className="font-mono text-[13px] tracking-[.14em] text-amber">● 404 · NO SIGNAL</span>
      <h1 className="headline text-[64px] md:text-[96px]">Say again?</h1>
      <p className="max-w-[460px] text-xl text-mute">That page isn&apos;t on our frequency.</p>
      <Link href="/" className="btn btn-primary">
        Return to base
      </Link>
    </main>
  );
}
