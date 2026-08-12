import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationSource,
  InlineCitationText,
} from "@/components/ai-elements/inline-citation";

afterEach(cleanup);

/**
 * Three sources behind one sentence — what a web-search answer carries. The
 * chat mounts no citation of its own, so this fixture is the only thing that
 * renders the element.
 */
const sources = [
  {
    description:
      "Shadow DOM lets an element hold a scoped tree with its own stylesheet, hidden from the page around it.",
    quote: "A shadow root is attached to an element and holds a separate DOM tree.",
    title: "Using shadow DOM",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM",
  },
  {
    description: "Constructable stylesheets are shared between roots without copying the text.",
    title: "Document.adoptedStyleSheets",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets",
  },
  {
    description: "The spec for shadow trees, slots and their event retargeting.",
    title: "DOM Standard — shadow trees",
    url: "https://dom.spec.whatwg.org/#shadow-trees",
  },
];

function Citation({ open = true }: { open?: boolean }) {
  return (
    <InlineCitation>
      <InlineCitationText>
        Styles adopted by a shadow root do not reach the page.
      </InlineCitationText>
      <InlineCitationCard open={open}>
        <InlineCitationCardTrigger sources={sources.map((source) => source.url)} />
        <InlineCitationCardBody>
          <InlineCitationCarousel>
            <InlineCitationCarouselHeader>
              <InlineCitationCarouselPrev />
              <InlineCitationCarouselNext />
              <InlineCitationCarouselIndex />
            </InlineCitationCarouselHeader>
            <InlineCitationCarouselContent>
              {sources.map((source) => (
                <InlineCitationCarouselItem key={source.url}>
                  <InlineCitationSource
                    description={source.description}
                    title={source.title}
                    url={source.url}
                  />
                  {source.quote && <InlineCitationQuote>{source.quote}</InlineCitationQuote>}
                </InlineCitationCarouselItem>
              ))}
            </InlineCitationCarouselContent>
          </InlineCitationCarousel>
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  );
}

describe("InlineCitation", () => {
  it("labels the trigger with the first hostname and the extra count", () => {
    render(<Citation open={false} />);

    expect(screen.getByText("developer.mozilla.org +2")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("falls back to the raw string when a source is not a URL, and to unknown when empty", () => {
    render(
      <>
        <InlineCitationCard open={false}>
          <InlineCitationCardTrigger sources={["internal-notes"]} />
        </InlineCitationCard>
        <InlineCitationCard open={false}>
          <InlineCitationCardTrigger sources={[]} />
        </InlineCitationCard>
      </>,
    );

    expect(screen.getByText("internal-notes")).toBeTruthy();
    expect(screen.getByText("unknown")).toBeTruthy();
  });

  it("shows every source in the card, with the position readout", () => {
    render(<Citation />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Using shadow DOM")).toBeTruthy();
    expect(screen.getByText("DOM Standard — shadow trees")).toBeTruthy();
    expect(screen.getByText("1/3")).toBeTruthy();
  });

  it("pages with the carousel buttons, and stops at the ends", () => {
    render(<Citation />);
    const previous = screen.getByLabelText("Previous") as HTMLButtonElement;
    const next = screen.getByLabelText("Next") as HTMLButtonElement;

    expect(previous.disabled).toBe(true); // At the first slide.
    expect(next.disabled).toBe(false);

    fireEvent.click(next);
    expect(screen.getByText("2/3")).toBeTruthy();
    expect(previous.disabled).toBe(false);

    fireEvent.click(next);
    expect(screen.getByText("3/3")).toBeTruthy();
    expect(next.disabled).toBe(true); // At the last one.

    fireEvent.click(previous);
    expect(screen.getByText("2/3")).toBeTruthy();
  });
});
