"use client";

import { Button } from "@/components/ui/button";

export function OAuthQuickButtons() {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="text-xs h-9 cursor-pointer"
          onClick={() => {
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/api/accounts/oauth/google";
          }}
        >
          Google Workspace
        </Button>
        <Button
          type="button"
          variant="outline"
          className="text-xs h-9 cursor-pointer"
          onClick={() => {
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/api/accounts/oauth/microsoft";
          }}
        >
          Microsoft 365
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Connexion sécurisée en 1 clic sans mot de passe d&apos;application via OAuth 2.0.
      </p>
    </div>
  );
}
