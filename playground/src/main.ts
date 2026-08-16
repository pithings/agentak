import { createApp } from "vue";

import { tokens } from "@/styles/base.ts";
import App from "./app.vue";
// Registers the demo renderers the catalog and the canned turns reach for.
// Side effect: import it once.
import "./demo-elements.tsx";
import { registerPageTools } from "./page-tools.ts";
import { router } from "./router.ts";
import "./styles.css";
import { paint } from "./theme.ts";

/**
 * Playground entry: a vue SPA that hosts the library.
 *
 * The page declares the `--*` tokens itself, the way a host page must —
 * nothing in the library injects them, and the widget's shadow root inherits
 * them from here. The page's own tailwind theme reads the same names.
 */
document.head.append(Object.assign(document.createElement("style"), { textContent: tokens }));
paint();
// The tools this page offers an agent, where the browser carries WebMCP. The
// chat reads them through `page: true` — see `page-tools.ts`.
registerPageTools();

createApp(App).use(router).mount("#app");
