// Client-side filtering for /cakes/ (M3 Stage 6): search by cake name and one category chip,
// combined with AND logic. It only hides and shows the server-rendered cards (the `hidden`
// attribute, so hidden cards leave the Tab order); it never removes, reorders or re-renders them.
//
// Nothing about a cake is restated here: names are read from each card's heading, and category
// membership comes from the audited collections, serialised at build time by CatalogFilter.astro.
// The selected category is kept in the `category` query parameter (replaceState, no new history
// entries) so it is restored when returning from a cake's page.

/** Chip value meaning "no category filter". */
export const ALL = "all";

export interface FilterState {
  query: string;
  category: string;
}

/** Case-insensitive search text: surrounding whitespace ignored, inner runs collapsed. */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

/** True when a cake matches both the search text and the selected category. */
export function matchesFilter(name: string, categories: readonly string[], state: FilterState): boolean {
  const query = normalizeQuery(state.query);
  const inCategory = state.category === ALL || categories.includes(state.category);
  return inCategory && (query === "" || name.toLowerCase().includes(query));
}

/** Result count for the live region, e.g. "Showing 6 of 23 cakes". */
export function statusMessage(shown: number, total: number): string {
  return shown === total ? `Showing all ${total} cakes` : `Showing ${shown} of ${total} cakes`;
}

/** Explanation shown when nothing matches. Never suggests that a cake is unavailable. */
export function emptyMessage(state: FilterState, categoryLabel: string | undefined): string {
  const query = state.query.trim().replace(/\s+/g, " ");
  if (query && categoryLabel) return `No ${categoryLabel} cakes in the catalogue match “${query}”.`;
  if (query) return `No cake names in the catalogue match “${query}”.`;
  return "No cakes in the catalogue match these filters.";
}

const STATUS_DELAY_MS = 400; // let typing settle before the live region speaks

export function initCatalogFilter(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>("form");
  const input = root.querySelector<HTMLInputElement>("input[type='search']");
  const status = root.querySelector<HTMLElement>("[data-filter-status]");
  const reset = root.querySelector<HTMLButtonElement>("[data-filter-reset]");
  const empty = root.querySelector<HTMLElement>("[data-filter-empty]");
  const emptyText = root.querySelector<HTMLElement>("[data-filter-empty-text]");
  const clear = root.querySelector<HTMLButtonElement>("[data-filter-clear]");
  const list = root.dataset.list ? document.querySelector<HTMLElement>(root.dataset.list) : null;
  if (!form || !input || !status || !reset || !empty || !emptyText || !clear || !list) return;

  const memberships = JSON.parse(root.dataset.memberships ?? "{}") as Record<string, string[]>;
  const chips = [...root.querySelectorAll<HTMLButtonElement>(".chip[data-value]")];
  const items = [...list.children].map((element) => ({
    element: element as HTMLElement,
    name: element.querySelector(".cake-card__name")?.textContent?.trim() ?? "",
    categories: memberships[element.id] ?? [],
  }));
  const isCategory = (value: string | null): value is string => !!value && chips.some((c) => c.dataset.value === value);

  const state: FilterState = { query: input.value, category: ALL };
  const fromUrl = new URL(window.location.href).searchParams.get("category");
  if (isCategory(fromUrl)) state.category = fromUrl;

  let statusTimer: number | undefined;

  const apply = (announce: "now" | "later") => {
    let shown = 0;
    for (const item of items) {
      const visible = matchesFilter(item.name, item.categories, state);
      item.element.hidden = !visible;
      if (visible) shown++;
    }
    for (const chip of chips) chip.setAttribute("aria-pressed", String(chip.dataset.value === state.category));

    const label = chips.find((c) => c.dataset.value === state.category && state.category !== ALL)?.textContent?.trim();
    emptyText.textContent = emptyMessage(state, label);
    empty.hidden = shown > 0;
    list.hidden = shown === 0; // no empty list for assistive technology; the empty state explains

    const message = statusMessage(shown, items.length);
    window.clearTimeout(statusTimer);
    if (announce === "now") status.textContent = message;
    else statusTimer = window.setTimeout(() => (status.textContent = message), STATUS_DELAY_MS);

    const url = new URL(window.location.href);
    if (state.category === ALL) url.searchParams.delete("category");
    else url.searchParams.set("category", state.category);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  };

  const resetAll = () => {
    input.value = "";
    state.query = "";
    state.category = ALL;
    apply("now");
  };

  form.addEventListener("submit", (event) => event.preventDefault()); // Enter never reloads the page
  input.addEventListener("input", () => {
    state.query = input.value;
    apply("later");
  });
  for (const chip of chips) {
    chip.addEventListener("click", () => {
      state.category = chip.dataset.value ?? ALL;
      apply("now");
    });
  }
  reset.addEventListener("click", resetAll); // focus stays on Reset, which remains visible
  clear.addEventListener("click", () => {
    resetAll();
    input.focus(); // the empty state (and this button) is now hidden
  });

  apply("now");
}
