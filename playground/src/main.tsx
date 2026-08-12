import { render } from "preact";
import { Playground } from "./playground";

/**
 * Playground entry: renders the UI directly (no shadow DOM) so styles and
 * devtools behave normally while iterating.
 *
 * Nothing is injected into the document — `Playground` declares the tokens in a
 * `<style>` of its own, the way a host page would.
 */
render(<Playground />, document.querySelector("#root")!);
