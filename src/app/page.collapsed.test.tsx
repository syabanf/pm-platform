import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";
import { PrototypeProvider } from "@/lib/store";

/**
 * A collapsed subtree must be closed to the keyboard too.
 *
 * The portfolio tree collapses with the `.animate-collapse` grid trick, which
 * takes the height to zero and clips the overflow — but every link inside
 * keeps its own box, so without `inert` a shut client's projects and modules
 * stay in the tab order and in the accessibility tree. Folder.tsx has carried
 * that fix since it was written; this tree did not, and it is the same defect
 * that left the closed mobile drawer holding 38 reachable links.
 *
 * Counted, not timed. The number is an integer and it must be zero.
 */
describe("the home portfolio tree", () => {
  it("leaves nothing focusable inside a collapsed client", () => {
    const { container } = render(
      <PrototypeProvider>
        <HomePage />
      </PrototypeProvider>
    );

    // Sanity: the tree rendered and something really is collapsed, or the
    // assertion below would pass by finding no regions at all.
    const collapsed = container.querySelectorAll('[data-open="false"]');
    expect(collapsed.length, "no collapsed regions — has the tree changed?").toBeGreaterThan(0);

    // `inert` is what removes them; the nodes themselves stay in the DOM, so
    // counting nodes would measure nothing. Count the ones NOT inside an inert
    // subtree — that is the set a keyboard can still reach.
    const inside = [
      ...container.querySelectorAll(
        '[data-open="false"] a, [data-open="false"] button, [data-open="false"] input'
      ),
    ];
    expect(inside.length, "no controls in the collapsed regions at all?").toBeGreaterThan(0);

    const reachable = inside.filter((el) => !el.closest("[inert]"));
    expect(
      reachable.length,
      `${reachable.length} of ${inside.length} controls inside a collapsed client are still reachable`
    ).toBe(0);
  });

  it("keeps the expanded client's own links reachable", () => {
    // The other half: `inert` on the wrong branch would silently disable the
    // one client the page opens with.
    const { container } = render(
      <PrototypeProvider>
        <HomePage />
      </PrototypeProvider>
    );
    const open = container.querySelectorAll('[data-open="true"] a');
    expect(open.length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
  });
});
