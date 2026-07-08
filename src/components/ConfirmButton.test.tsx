import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ConfirmButton } from "./ConfirmButton";

describe("ConfirmButton", () => {
  it("requires two clicks to confirm", () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton onConfirm={onConfirm} />);

    const button = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm?" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // disarmed again after confirming
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("disarms automatically after 3 seconds", () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    render(<ConfirmButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
