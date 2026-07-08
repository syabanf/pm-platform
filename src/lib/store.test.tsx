import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { PrototypeProvider, usePrototype } from "./store";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PrototypeProvider>{children}</PrototypeProvider>
);

describe("prototype store", () => {
  it("blocks moving a task to Done while its DoD is incomplete", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    // t2 (Build OEE dashboard UI) has an incomplete DoD in the seed
    let moved = true;
    act(() => {
      moved = result.current.moveTask("t2", "done");
    });
    expect(moved).toBe(false);
    expect(result.current.tasks.find((t) => t.id === "t2")?.column).not.toBe(
      "done"
    );
    expect(result.current.toast?.message).toMatch(/Definition of Done/);
  });

  it("allows the move once every DoD item is checked", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    const dod = result.current.tasks.find((t) => t.id === "t2")!.dod;
    act(() => {
      dod.forEach((item, i) => {
        if (!item.done) result.current.toggleDod("t2", i);
      });
    });
    let moved = false;
    act(() => {
      moved = result.current.moveTask("t2", "done");
    });
    expect(moved).toBe(true);
    expect(result.current.tasks.find((t) => t.id === "t2")?.column).toBe("done");
  });

  it("cascades client deletion to projects and products", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    act(() => {
      result.current.removeClientCascade("ubs-gold");
    });
    expect(result.current.clients.some((c) => c.id === "ubs-gold")).toBe(false);
    expect(
      result.current.projects.some((p) => p.clientId === "ubs-gold")
    ).toBe(false);
    expect(
      result.current.products.some((p) => p.clientId === "ubs-gold")
    ).toBe(false);
  });

  it("renaming a master value propagates to referencing records", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    act(() => {
      result.current.renameMasterValue(
        "industries",
        "Manufacturing",
        "Smart Manufacturing"
      );
    });
    expect(result.current.masters.industries).toContain("Smart Manufacturing");
    expect(
      result.current.clients.find((c) => c.id === "ubs-gold")?.industry
    ).toBe("Smart Manufacturing");
  });

  it("rejects duplicate master values case-insensitively", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    let added = true;
    act(() => {
      added = result.current.addMasterValue("industries", "banking");
    });
    expect(added).toBe(false);
  });

  it("marking a report sent completes the matching queue item", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    act(() => {
      result.current.saveGeneratedReport({
        id: "r-test",
        productId: "oee-intelligence",
        config: { type: "Sprint Report", template: "Client Facing", period: "Current Sprint" },
        date: "2026-07-08",
        status: "draft",
      });
    });
    act(() => {
      result.current.markReportSent("r-test");
    });
    expect(
      result.current.generatedReports.find((r) => r.id === "r-test")?.status
    ).toBe("sent");
    const queueItem = result.current.reportQueue.find(
      (q) => q.productId === "oee-intelligence" && q.type === "Sprint Report" && q.id === "rq1"
    );
    expect(queueItem?.status).toBe("done");
  });
});
