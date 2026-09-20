import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  // Buttons or links that belong to the whole page (Add, Import...).
  actions?: ReactNode;
  // Marks the header as a target for the guided tour.
  tourId?: string;
}

// The title block at the top of a page: one compact row that wraps on a phone.
// It replaces the large "hero" card pages used to open with, which took a
// third of the screen before any content appeared. This is the page's ONE
// h1: the app bar above it carries the brand, not a heading.
export default function PageHeader({ title, subtitle, actions, tourId }: PageHeaderProps) {
  return (
    <header
      className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 sm:mb-6"
      {...(tourId ? { "data-tour": tourId } : {})}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-wide text-yellow-300 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/70">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
