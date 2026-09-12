import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SwipeableMessageItem } from "./SwipeableMessageItem";

describe("SwipeableMessageItem", () => {
  const originalTouchStart = window.ontouchstart;
  const originalMaxTouchPoints = navigator.maxTouchPoints;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore touch properties
    if (originalTouchStart !== undefined) {
      window.ontouchstart = originalTouchStart;
    } else {
      delete (window as unknown as { ontouchstart?: unknown }).ontouchstart;
    }
    Object.defineProperty(navigator, "maxTouchPoints", {
      value: originalMaxTouchPoints,
      configurable: true,
    });
  });

  it("affiche le contenu enfant correctement en mode non-touch (desktop)", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    render(
      <SwipeableMessageItem
        swipeRightAction="toggle_read"
        swipeLeftAction="trash"
        onTriggerAction={vi.fn()}
      >
        <div data-testid="child-content">Message Email Test</div>
      </SwipeableMessageItem>,
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Message Email Test")).toBeInTheDocument();
  });

  it("n'active pas le balayage si disabled est vrai", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 1, configurable: true });
    render(
      <SwipeableMessageItem
        swipeRightAction="toggle_read"
        swipeLeftAction="trash"
        onTriggerAction={vi.fn()}
        disabled={true}
      >
        <div data-testid="child-content">Message Désactivé</div>
      </SwipeableMessageItem>,
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    // Pas de conteneur avec pan-y
    expect(screen.queryByText("LU / NON-LU")).not.toBeInTheDocument();
  });

  it("affiche les indicateurs d'actions tactiles quand le device est tactile", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 2, configurable: true });
    render(
      <SwipeableMessageItem
        swipeRightAction="toggle_read"
        swipeLeftAction="trash"
        onTriggerAction={vi.fn()}
      >
        <div data-testid="child-content">Message Tactile</div>
      </SwipeableMessageItem>,
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Lu / Non-lu")).toBeInTheDocument();
    expect(screen.getByText("Corbeille")).toBeInTheDocument();
  });

  it("ne rend pas les indicateurs d'actions si les deux actions sont 'none'", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 2, configurable: true });
    render(
      <SwipeableMessageItem
        swipeRightAction="none"
        swipeLeftAction="none"
        onTriggerAction={vi.fn()}
      >
        <div data-testid="child-content">Message Sans Action</div>
      </SwipeableMessageItem>,
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.queryByText("Lu / Non-lu")).not.toBeInTheDocument();
    expect(screen.queryByText("Corbeille")).not.toBeInTheDocument();
  });
});
