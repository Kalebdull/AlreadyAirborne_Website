// Templates re-mount on every navigation, so each new page "climbs" into
// view: it rises, sharpens and fades in. The header and footer live in the
// layout and stay put.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter flex flex-1 flex-col">{children}</div>;
}
