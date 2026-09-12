import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlobalSearchResultItem } from "./GlobalSearchResultItem";
import type { Message } from "@/lib/api-types";

describe("GlobalSearchResultItem", () => {
  const fakeMessage: Message = {
    _id: "m-1",
    accountId: "acc-1",
    folder: "INBOX",
    uid: 42,
    subject: "Rapport trimestriel",
    from: { name: "Direction", address: "direction@company.com" },
    to: [{ address: "me@company.com" }],
    date: new Date("2026-03-15T10:00:00Z").toISOString(),
    flags: { seen: false, answered: false, flagged: true },
    hasAttachments: true,
    size: 512000,
    accountColor: "#3b82f6",
    accountEmail: "pro@company.com",
  };

  it("affiche les informations du message avec pastille de couleur de compte", () => {
    render(
      <GlobalSearchResultItem
        message={fakeMessage}
        isSelected={false}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText("Direction")).toBeInTheDocument();
    expect(screen.getByText("INBOX")).toBeInTheDocument();
    expect(screen.getByText("Rapport trimestriel")).toBeInTheDocument();

    const colorDot = screen.getByTitle("pro@company.com");
    expect(colorDot).toBeInTheDocument();
    expect(colorDot).toHaveStyle({ backgroundColor: "rgb(59, 130, 246)" });
  });

  it("appelle onSelect lors du clic sur l'élément", async () => {
    const onSelectMock = vi.fn();
    render(
      <GlobalSearchResultItem
        message={fakeMessage}
        isSelected={true}
        onSelect={onSelectMock}
      />
    );

    const btn = screen.getByRole("button");
    await userEvent.click(btn);

    expect(onSelectMock).toHaveBeenCalledWith(fakeMessage);
  });
});
