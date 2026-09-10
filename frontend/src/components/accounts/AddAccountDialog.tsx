"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateAccount } from "@/lib/queries/accounts";
import { useAutoconfig } from "@/lib/queries/autoconfig";
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
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INITIAL_FORM = {
  emailAddress: "",
  displayName: "",
  imapHost: "",
  imapPort: "993",
  imapSecure: true,
  imapUsername: "",
  imapPassword: "",
  smtpHost: "",
  smtpPort: "465",
  smtpSecure: true,
};

export function AddAccountDialog({ open, onOpenChange }: AddAccountDialogProps) {
  const router = useRouter();
  const createAccount = useCreateAccount();
  const [form, setForm] = useState(INITIAL_FORM);

  const { data: autoconfig, isFetching: autoconfigLoading } = useAutoconfig(form.emailAddress);

  const applyAutoconfig = () => {
    if (!autoconfig?.imap || !autoconfig?.smtp) return;
    setForm((prev) => ({
      ...prev,
      imapHost: autoconfig.imap?.host ?? prev.imapHost,
      imapPort: String(autoconfig.imap?.port ?? prev.imapPort),
      imapSecure: autoconfig.imap?.secure ?? prev.imapSecure,
      smtpHost: autoconfig.smtp?.host ?? prev.smtpHost,
      smtpPort: String(autoconfig.smtp?.port ?? prev.smtpPort),
      smtpSecure: autoconfig.smtp?.secure ?? prev.smtpSecure,
      imapUsername:
        autoconfig.imap?.usernameRule === "localpart"
          ? prev.emailAddress.split("@")[0]
          : prev.emailAddress,
    }));
    toast.success("Paramètres IMAP & SMTP appliqués");
  };

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAccount.mutate(
      {
        emailAddress: form.emailAddress,
        displayName: form.displayName || undefined,
        imap: {
          host: form.imapHost,
          port: Number(form.imapPort),
          secure: form.imapSecure,
          username: form.imapUsername || form.emailAddress,
          password: form.imapPassword,
        },
        smtp: {
          host: form.smtpHost,
          port: Number(form.smtpPort),
          secure: form.smtpSecure,
        },
      },
      {
        onSuccess: (account) => {
          toast.success("Compte ajouté avec succès");
          onOpenChange(false);
          setForm(INITIAL_FORM);
          router.push(`/mail/${account._id}/INBOX`);
        },
        onError: (err) => {
          if (err instanceof ApiError) toast.error(err.message);
          else toast.error("Erreur lors de l'ajout du compte");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border bg-card max-h-[90vh] max-w-lg overflow-y-auto p-6 shadow-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle>Ajouter un compte</DialogTitle>
        </DialogHeader>

        {/* Connexion OAuth rapide (Google & Microsoft) */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="text-xs h-9"
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
              className="text-xs h-9"
              onClick={() => {
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.href = "/api/accounts/oauth/microsoft";
              }}
            >
              Microsoft 365
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Connexion sécurisée sans mot de passe d&apos;application via OAuth 2.0 (XOAUTH2).
          </p>
        </div>

        <div className="my-2 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou IMAP standard</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email">Adresse email</Label>
              {autoconfigLoading && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" /> Détection des paramètres...
                </span>
              )}
              {autoconfig?.detected && (
                <button
                  type="button"
                  onClick={applyAutoconfig}
                  className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium hover:underline cursor-pointer"
                >
                  <Sparkles className="size-3" /> Appliquer ({autoconfig.source.toUpperCase()})
                </button>
              )}
            </div>
            <Input
              id="email"
              type="email"
              value={form.emailAddress}
              onChange={(e) => update("emailAddress", e.target.value)}
              placeholder="vous@exemple.com"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName">Nom d&apos;affichage (optionnel)</Label>
            <Input
              id="displayName"
              value={form.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              placeholder="Mon compte pro"
            />
          </div>

          <div className="my-2 border-t border-border" />

          <h3 className="text-sm font-medium text-muted-foreground">Configuration IMAP</h3>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="imapHost">Hôte IMAP</Label>
              <Input
                id="imapHost"
                value={form.imapHost}
                onChange={(e) => update("imapHost", e.target.value)}
                placeholder="imap.exemple.com"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="imapPort">Port</Label>
              <Input
                id="imapPort"
                type="number"
                value={form.imapPort}
                onChange={(e) => update("imapPort", e.target.value)}
                placeholder="993"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="imapSecure"
              type="checkbox"
              checked={form.imapSecure}
              onChange={(e) => update("imapSecure", e.target.checked)}
              className="size-4 accent-primary"
            />
            <Label htmlFor="imapSecure" className="text-sm">
              SSL/TLS
            </Label>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="imapUsername">Nom d&apos;utilisateur IMAP</Label>
            <Input
              id="imapUsername"
              value={form.imapUsername}
              onChange={(e) => update("imapUsername", e.target.value)}
              placeholder="Laisser vide pour utiliser l'email"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="imapPassword">Mot de passe IMAP</Label>
            <Input
              id="imapPassword"
              type="password"
              value={form.imapPassword}
              onChange={(e) => update("imapPassword", e.target.value)}
              required
            />
          </div>

          <div className="my-2 border-t border-border" />

          <h3 className="text-sm font-medium text-muted-foreground">Configuration SMTP</h3>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="smtpHost">Hôte SMTP</Label>
              <Input
                id="smtpHost"
                value={form.smtpHost}
                onChange={(e) => update("smtpHost", e.target.value)}
                placeholder="smtp.exemple.com"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="smtpPort">Port</Label>
              <Input
                id="smtpPort"
                type="number"
                value={form.smtpPort}
                onChange={(e) => update("smtpPort", e.target.value)}
                placeholder="465"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="smtpSecure"
              type="checkbox"
              checked={form.smtpSecure}
              onChange={(e) => update("smtpSecure", e.target.checked)}
              className="size-4 accent-primary"
            />
            <Label htmlFor="smtpSecure" className="text-sm">
              SSL/TLS
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createAccount.isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={createAccount.isPending}>
              {createAccount.isPending ? <Loader2 className="size-4 animate-spin" /> : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
