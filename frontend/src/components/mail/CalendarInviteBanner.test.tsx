import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarInviteBanner } from "./CalendarInviteBanner";
import type { CalendarEventInfo } from "@/lib/api-types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("CalendarInviteBanner", () => {
  const baseEvent: CalendarEventInfo = {
    summary: "Point synchronisation hebdomadaire",
    dtStart: "2026-10-12T10:00:00.000Z",
    dtEnd: "2026-10-12T11:00:00.000Z",
    location: "Salle Titan / Google Meet",
    organizer: { name: "Alice Dupont", email: "alice@example.com" },
    attendees: [
      { name: "Bob", email: "bob@example.com" },
      { name: "Charlie", email: "charlie@example.com" },
    ],
    rawIcs: "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Point\r\nEND:VEVENT\r\nEND:VCALENDAR",
  };

  it("affiche les détails de l'invitation d'agenda", () => {
    render(<CalendarInviteBanner calendarEvent={baseEvent} />);

    expect(screen.getByText("Point synchronisation hebdomadaire")).toBeInTheDocument();
    expect(screen.getByText("Invitation d'agenda")).toBeInTheDocument();
    expect(screen.getByText(/Salle Titan/)).toBeInTheDocument();
    expect(screen.getByText(/Alice Dupont/)).toBeInTheDocument();
    expect(screen.getByText("2 participants")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exporter \(\.ics\)/i })).toBeInTheDocument();
  });

  it("affiche le statut annulé pour un événement annulé", () => {
    const cancelledEvent: CalendarEventInfo = {
      ...baseEvent,
      status: "CANCELLED",
      method: "CANCEL",
    };

    render(<CalendarInviteBanner calendarEvent={cancelledEvent} />);

    expect(screen.getByText("Événement annulé")).toBeInTheDocument();
  });

  it("déclenche le téléchargement du fichier .ics au clic", async () => {
    const createObjectURLMock = vi.fn().mockReturnValue("blob:http://localhost/mock-blob");
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    render(<CalendarInviteBanner calendarEvent={baseEvent} />);

    const exportBtn = screen.getByRole("button", { name: /Exporter \(\.ics\)/i });
    await userEvent.click(exportBtn);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/mock-blob");
  });
});
