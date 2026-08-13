import { ref } from "vue";

export type Theme = "light" | "dark";

const KEY = "agentak-playground-theme";

/**
 * Light and dark are one class on the root — every `--*` pair hangs off it,
 * and the page's own tailwind `dark:` variant reads the same class — so this is
 * the whole theme switch. It opens on the stored choice, else on the system.
 */
export const theme = ref<Theme>(stored() ?? system());

export function setTheme(next: Theme) {
  theme.value = next;
  localStorage.setItem(KEY, next);
  paint();
}

export function toggleTheme() {
  setTheme(theme.value === "dark" ? "light" : "dark");
}

/** Put the opening choice on the root, before the first paint. */
export function paint() {
  document.documentElement.classList.toggle("dark", theme.value === "dark");
}

function stored(): Theme | null {
  const value = globalThis.localStorage?.getItem(KEY);
  return value === "dark" || value === "light" ? value : null;
}

function system(): Theme {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
