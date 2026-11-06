import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-raised px-6 py-6">
      <div className="mx-auto flex max-w-[1024px] flex-wrap justify-between gap-4 text-xs text-dim">
        <span>© {new Date().getFullYear()} {site.name}</span>
        <span>
          <a href={site.instagram.url} className="hover:text-ink">
            @{site.instagram.handle}
          </a>
          {" · "}
          <a href={`mailto:${site.email}`} className="hover:text-ink">
            {site.email}
          </a>
        </span>
        <span className="font-mono">SQUAWK 1200</span>
      </div>
    </footer>
  );
}
