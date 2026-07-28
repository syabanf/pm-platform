import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field, Input } from "@/components/ui";
import { Toast } from "@/components/Toast";
import { PrototypeProvider } from "@/lib/store";

/**
 * These three failed silently for a long time: nothing crashed, nothing looked
 * wrong, and every form in the app was simply unusable with a screen reader.
 * They are cheap to assert and expensive to notice, which is exactly what a
 * test is for.
 */
describe("accessible names", () => {
  it("gives a Field's control the label as its name", () => {
    render(
      <Field label="Workspace Name">
        <Input defaultValue="WIT" />
      </Field>
    );
    // getByLabelText resolves the same association a screen reader announces,
    // so this fails if the label goes back to being a plain div.
    expect(screen.getByLabelText("Workspace Name")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Workspace Name" })
    ).toBeInTheDocument();
  });

  it("names a select and a range the same way", () => {
    render(
      <>
        <Field label="Industry">
          <select defaultValue="a">
            <option value="a">A</option>
          </select>
        </Field>
        <Field label="Sprint Length">
          <input type="range" min={1} max={4} defaultValue={2} />
        </Field>
      </>
    );
    expect(screen.getByRole("combobox", { name: "Industry" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Sprint Length" })).toBeInTheDocument();
  });
});

describe("toast live region", () => {
  it("exists before there is anything to announce", () => {
    // A region created at the same moment as its text is never announced:
    // assistive tech only reports mutations inside a region it already watches.
    const { container } = render(
      <PrototypeProvider>
        <Toast />
      </PrototypeProvider>
    );
    const region = container.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region!.textContent).toBe("");
  });
});
