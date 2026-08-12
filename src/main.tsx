import { render } from "preact";
import { Playground } from "@/playground";
import { adoptStyles } from "@/styles/sheet";

/**
 * Playground entry: renders the UI directly (no shadow DOM) so styles and
 * devtools behave normally while iterating.
 */
adoptStyles(document);
render(<Playground />, document.querySelector("#root")!);
