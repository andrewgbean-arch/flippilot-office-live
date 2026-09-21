// Reading and driving the element tree a component returns, for tests that run a
// screen through the hook stand-in (hookRuntime.ts). There is no DOM here, so a
// "screen" is the tree of React elements its function returns: this finds
// things in it by id, label or text and calls their handlers the way a browser
// would (onChange with an event-shaped object, onClick with nothing).

export interface El {
  type: unknown;
  props: Record<string, any>;
}

export const isElement = (node: unknown): node is El => typeof node === "object" && node !== null && "props" in node;

export function walk(node: unknown, visit: (el: El) => void) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (!isElement(node)) return;
  visit(node);
  walk(node.props.children, visit);
}

export function findAll(root: unknown, match: (el: El) => boolean): El[] {
  const found: El[] = [];
  walk(root, (el) => {
    if (match(el)) found.push(el);
  });
  return found;
}

// The text under a node. Pieces of text inside one element join directly (a
// paragraph written as "Imported {n} vehicles." reads as one sentence); each
// element's text is set apart by a space, so neighbouring cells and labels don't
// run together.
export function textOf(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isElement(node)) return ` ${textOf(node.props.children)} `;
  return "";
}

// The words on the screen, in reading order, on one line.
export const screenText = (root: unknown): string => textOf(root).replace(/\s+/g, " ").trim();

export const byId = (root: unknown, id: string): El | undefined => findAll(root, (el) => el.props.id === id)[0];

// A component from the app's own UI kit (SupernovaInput) is found by its label prop.
export const byLabel = (root: unknown, label: string): El | undefined => findAll(root, (el) => el.props.label === label)[0];

// A plain <button> by its visible text.
export const buttonByText = (root: unknown, text: string): El | undefined =>
  findAll(root, (el) => el.type === "button" && textOf(el).replace(/\s+/g, " ").trim() === text)[0];

// Type into a plain <input>/<select>/<textarea>: React calls onChange with an event.
export function typeInto(el: El | undefined, value: string) {
  if (!el) throw new Error("nothing to type into");
  el.props.onChange({ target: { value } });
}

// The alert paragraphs (role="alert") currently on screen.
export const alerts = (root: unknown): string[] =>
  findAll(root, (el) => el.props.role === "alert").map((el) => textOf(el).replace(/\s+/g, " ").trim());
