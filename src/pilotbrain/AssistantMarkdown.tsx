import ReactMarkdown, { type Components } from "react-markdown";
import { safeUrl } from "./safeUrl";

// Pilot Brain's replies come back as real markdown (headers, bold, lists,
// dividers) — rendering it raw showed the literal #/**/--- characters
// instead of actual formatting. Compact overrides here keep it sized
// for a chat bubble rather than a full page (default h1/h2 are huge).
//
// What a reply may DO is deliberately narrow, because the text can be shaped
// by things nobody on the team wrote (web pages, names typed into the public
// booking form):
//  - No images at all. A markdown image is fetched the moment it's drawn, with
//    no click, so a reply could smuggle private figures out in the address.
//    The picture is dropped; only its alt text (plain text) is kept.
//  - Links must be http(s) or mailto, and always open in a new tab with
//    noopener noreferrer. Anything else (javascript:, data:, a relative path)
//    becomes plain text.
//  - No raw HTML: react-markdown shows it as literal text, never as elements
//    (and this file doesn't add rehype-raw to change that).
export const assistantMarkdownComponents: Components = {
  p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
  h1: ({ children }) => <h3 style={{ margin: "4px 0 8px", fontSize: 16, color: "#ffd700" }}>{children}</h3>,
  h2: ({ children }) => <h4 style={{ margin: "4px 0 6px", fontSize: 15, color: "#ffd700" }}>{children}</h4>,
  h3: ({ children }) => <h5 style={{ margin: "4px 0 6px", fontSize: 14, color: "#ffd700" }}>{children}</h5>,
  strong: ({ children }) => <strong style={{ color: "#fff" }}>{children}</strong>,
  ul: ({ children }) => <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: "0 0 8px", paddingLeft: 18 }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
  hr: () => <hr style={{ margin: "10px 0", border: "none", borderTop: "1px solid rgba(255,255,255,0.12)" }} />,
  a: ({ href, children }) => {
    const safe = safeUrl(href, { allowMailto: true });
    return safe ? (
      <a href={safe} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    );
  },
  img: ({ alt }) => (alt ? <span>{alt}</span> : null),
};

export default function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown components={assistantMarkdownComponents}>{content}</ReactMarkdown>
  );
}
