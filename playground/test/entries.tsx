import { CATALOG } from "../src/catalog";

/**
 * Every fixture at once, without the vue chrome — the page mounts each of these
 * as an island of its own, and these tests care about the islands.
 */
export function AllEntries() {
  return (
    <>
      {CATALOG.flatMap((section) =>
        section.entries.map((entry) => (
          <div data-entry={entry.name} key={entry.name}>
            {entry.render()}
          </div>
        )),
      )}
    </>
  );
}
