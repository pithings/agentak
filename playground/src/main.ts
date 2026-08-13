import { createApp } from "vue";

import { tokens } from "@/styles/base";
import App from "./app.vue";
// Registers the demo renderers the catalog and the canned turns reach for.
// Side effect: import it once.
import "./demo-elements";
import { router } from "./router";
import "./styles.css";
import { paint } from "./theme";

/**
 * Playground entry: a vue SPA that hosts the library.
 *
 * The page declares the `--wa-*` tokens itself, the way a host page must —
 * nothing in the library injects them, and the widget's shadow root inherits
 * them from here. The page's own tailwind theme reads the same names.
 */
document.head.append(Object.assign(document.createElement("style"), { textContent: tokens }));
paint();

createApp(App).use(router).mount("#app");
