import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { documentTitleFor } from "@/lib/pageTitles";

// Keeps the browser tab's title in step with the page, and says the new page
// aloud for screen-reader users: the app swaps pages without a reload, so
// nothing else tells them anything happened. Mount once, inside the router.
export default function PageTitle() {
  const { pathname } = useLocation();
  const title = documentTitleFor(pathname);

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {title}
    </div>
  );
}
