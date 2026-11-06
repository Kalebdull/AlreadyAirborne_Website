// Splits a line into words that rise into place one after another on load.
export function RiseText({ text, delay = 0, step = 70 }: { text: string; delay?: number; step?: number }) {
  const words = text.split(" ");
  return (
    <span aria-label={text} className="inline">
      {words.map((word, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[.08em] align-bottom">
          <span className="rise-word inline-block" style={{ animationDelay: `${delay + i * step}ms` }}>
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </span>
  );
}
