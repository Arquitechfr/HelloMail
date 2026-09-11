import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleSendDialog } from "./ScheduleSendDialog";

describe("ScheduleSendDialog", () => {
  it("affiche les options de presets temporels", () => {
    const onSchedule = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ScheduleSendDialog
        open={true}
        onOpenChange={onOpenChange}
        onSchedule={onSchedule}
      />
    );

    expect(screen.getByText("Programmer l'envoi")).toBeInTheDocument();
    expect(screen.getByText("Demain matin")).toBeInTheDocument();
    expect(screen.getByText("Demain après-midi")).toBeInTheDocument();
    expect(screen.getByText("Lundi prochain")).toBeInTheDocument();
  });

  it("appelle onSchedule lors du clic sur un preset", async () => {
    const onSchedule = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ScheduleSendDialog
        open={true}
        onOpenChange={onOpenChange}
        onSchedule={onSchedule}
      />
    );

    const presetBtn = screen.getByRole("button", { name: /Demain matin/i });
    await userEvent.click(presetBtn);

    expect(onSchedule).toHaveBeenCalledTimes(1);
    expect(onSchedule.mock.calls[0][0]).toBeInstanceOf(Date);
  });

  it("permet de choisir une date et heure personnalisée dans le futur", async () => {
    const onSchedule = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ScheduleSendDialog
        open={true}
        onOpenChange={onOpenChange}
        onSchedule={onSchedule}
      />
    );

    const applyBtn = screen.getByRole("button", { name: /Confirmer la date/i });
    await userEvent.click(applyBtn);

    // Par défaut, la date personnalisée est demain à 08:00 (dans le futur)
    expect(onSchedule).toHaveBeenCalledTimes(1);
  });
});
