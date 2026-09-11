"use client";

import { useState } from "react";
import {
  use2FAStatus,
  useSetupTOTP,
  useEnableTOTP,
  useDisable2FA,
  useWebAuthnRegister,
} from "@/lib/queries/auth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, ShieldCheck, ShieldAlert, KeyRound } from "lucide-react";
import { toast } from "sonner";

export function TwoFactorSettings() {
  const { data: status, isLoading } = use2FAStatus();
  const setupTOTP = useSetupTOTP();
  const enableTOTP = useEnableTOTP();
  const disable2FA = useDisable2FA();
  const webauthnRegister = useWebAuthnRegister();

  const handleRegisterPasskey = () => {
    webauthnRegister.mutate(undefined, {
      onSuccess: () => {
        toast.success("Clé de sécurité (Passkey) enregistrée avec succès");
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Échec de l'enregistrement de la Passkey");
      },
    });
  };

  const [step, setStep] = useState<"idle" | "qr" | "verify">("idle");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisableDialog, setShowDisableDialog] = useState(false);

  const handleSetup = () => {
    setupTOTP.mutate(undefined, {
      onSuccess: (data) => {
        setQrCodeUrl(data.qrCodeUrl);
        setSecret(data.secret);
        setStep("qr");
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Erreur lors de la configuration");
      },
    });
  };

  const handleEnable = (e: React.FormEvent) => {
    e.preventDefault();
    enableTOTP.mutate(
      { token },
      {
        onSuccess: (data) => {
          setBackupCodes(data.backupCodes);
          setStep("idle");
          setToken("");
          toast.success("2FA activée avec succès");
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : "Code TOTP invalide");
        },
      },
    );
  };

  const handleDisable = (e: React.FormEvent) => {
    e.preventDefault();
    disable2FA.mutate(
      { password: disablePassword },
      {
        onSuccess: () => {
          setShowDisableDialog(false);
          setDisablePassword("");
          toast.success("2FA désactivée");
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : "Mot de passe invalide");
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Chargement...
      </div>
    );
  }

  const enabled = status?.twoFactorEnabled ?? false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex size-10 items-center justify-center rounded-xl ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
        >
          {enabled ? <ShieldCheck className="size-5" /> : <ShieldAlert className="size-5" />}
        </div>
        <div className="flex flex-col">
          <h3 className="text-sm font-medium">Authentification à deux facteurs</h3>
          <p className="text-xs text-muted-foreground">
            {enabled ? "Activée" : "Non activée"}
            {enabled && status && status.webauthnCredentialsCount > 0
              ? ` · ${status.webauthnCredentialsCount} passkey(s)`
              : ""}
          </p>
        </div>
      </div>

      {/* Étape QR code */}
      {step === "qr" && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h4 className="text-sm font-medium">Étape 1 : Scannez le QR code</h4>
          <p className="text-xs text-muted-foreground">
            {"Utilisez votre application d'authentification (Google Authenticator, Authy, etc.) pour scanner ce QR code."}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCodeUrl}
            alt="QR code TOTP"
            className="mx-auto size-48 rounded-lg border border-border"
          />
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Clé manuelle (si le QR ne fonctionne pas)</Label>
            <code className="rounded bg-muted px-2 py-1 text-xs">{secret}</code>
          </div>
          <Button onClick={() => setStep("verify")} className="mt-2">
            Continuer
          </Button>
        </div>
      )}

      {/* Étape vérification */}
      {step === "verify" && (
        <form onSubmit={handleEnable} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h4 className="text-sm font-medium">Étape 2 : Vérifiez le code</h4>
          <p className="text-xs text-muted-foreground">
            {"Saisissez le code à 6 chiffres de votre application d'authentification."}
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="totp-token">Code TOTP</Label>
            <Input
              id="totp-token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456"
              required
              maxLength={8}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={enableTOTP.isPending}>
              {enableTOTP.isPending ? <Loader2 className="size-4 animate-spin" /> : "Activer"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setStep("idle")}>
              Annuler
            </Button>
          </div>
        </form>
      )}

      {/* Codes de secours affichés après activation */}
      {backupCodes && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <h4 className="text-sm font-medium">Codes de secours</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            {"Conservez ces codes en lieu sûr. Chaque code ne peut être utilisé qu'une seule fois."}
          </p>
          <div className="grid grid-cols-2 gap-1 font-mono text-sm">
            {backupCodes.map((c) => (
              <code key={c} className="rounded bg-muted px-2 py-1">{c}</code>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setBackupCodes(null)}
          >
            {"J'ai noté les codes"}
          </Button>
        </div>
      )}

      {/* Boutons d'action */}
      {step === "idle" && !backupCodes && (
        <div className="flex flex-wrap gap-2">
          {enabled ? (
            <>
              <Button
                variant="outline"
                onClick={handleRegisterPasskey}
                disabled={webauthnRegister.isPending}
              >
                {webauthnRegister.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 size-4" />
                )}
                Ajouter une Passkey
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDisableDialog(true)}
                className="text-destructive"
              >
                Désactiver la 2FA
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleSetup} disabled={setupTOTP.isPending}>
                {setupTOTP.isPending ? <Loader2 className="size-4 animate-spin" /> : "Activer via TOTP"}
              </Button>
              <Button
                variant="outline"
                onClick={handleRegisterPasskey}
                disabled={webauthnRegister.isPending}
              >
                {webauthnRegister.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 size-4" />
                )}
                Activer avec une Passkey
              </Button>
            </>
          )}
        </div>
      )}

      {/* Dialog désactivation */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="glass-strong max-w-md">
          <DialogHeader>
            <DialogTitle>Désactiver la 2FA</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDisable} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {"Confirmez votre mot de passe pour désactiver l'authentification à deux facteurs."}
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="disable-password">Mot de passe</Label>
              <Input
                id="disable-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDisableDialog(false)}
              >
                Annuler
              </Button>
              <Button type="submit" variant="destructive" disabled={disable2FA.isPending}>
                {disable2FA.isPending ? <Loader2 className="size-4 animate-spin" /> : "Désactiver"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
