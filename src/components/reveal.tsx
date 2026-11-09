"use client";

import { useEffect } from "react";

const SELECTOR = ".reveal:not(.is-visible), .reveal-stagger:not(.is-visible)";

// Fades up `.reveal` elements (and the children of `.reveal-stagger`, one
// after another) as they scroll into view.
//
// Pages can stream in after a client-side navigation, so new elements are
// picked up as they're added to the page, not just once per route change.
// Otherwise a section that arrived late would stay invisible.
export function Reveal() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(SELECTOR).forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    const watch = (root: ParentNode) => {
      if (root instanceof Element && root.matches(SELECTOR)) io.observe(root);
      root.querySelectorAll(SELECTOR).forEach((el) => io.observe(el));
    };
    watch(document);
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && watch(n));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return null;
}
