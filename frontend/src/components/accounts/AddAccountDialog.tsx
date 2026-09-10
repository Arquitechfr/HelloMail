"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreateAccount } from "@/lib/queries/accounts";
import { useAutoconfig } from "@/lib/queries/autoconfig";
import { ServerSettingsAccordion } from "@/components/accounts/ServerSettingsAccordion";
import { AutoconfigBadge } from "@/components/accounts/AutoconfigBadge";
import { OAuthQuickButtons } from "@/components/accounts/OAuthQuickButtons";
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
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INITIAL_FORM = {
  emailAddress: "",
  displayName: "",
  password: "",
  imapHost: "",
  imapPort: "",
  imapSecure: true,
  imapUsername: "",
  smtpHost: "",
  smtpPort: "",
  smtpSecure: true,
};

export function AddAccountDialog({ open, onOpenChange }: AddAccountDialogProps) {
  const router = useRouter();
  const createAccount = useCreateAccount();
  const [form, setForm] = useState(INITIAL_FORM);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [debouncedEmail, setDebouncedEmail] = useState("");

  // Debounce email pour l'autoconfig (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEmail(form.emailAddress.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [form.emailAddress]);

  const { data: autoconfig, isFetching: autoconfigLoading } = useAutoconfig(debouncedEmail);

  // Valeurs effectives : saisie manuelle prioritaire, repli sur l'auto-détection
  const effectiveImapHost = form.imapHost || (autoconfig?.detected ? autoconfig.imap?.host ?? "" : "");
  const effectiveImapPort = form.imapPort || (autoconfig?.detected ? String(autoconfig.imap?.port ?? "993") : "993");
  const effectiveImapSecure = form.imapSecure;
  const effectiveImapUsername = form.imapUsername || (autoconfig?.detected && autoconfig.imap?.usernameRule === "localpart" ? form.emailAddress.split("@")[0] : form.emailAddress);
  const effectiveSmtpHost = form.smtpHost || (autoconfig?.detected ? autoconfig.smtp?.host ?? "" : "");
  const effectiveSmtpPort = form.smtpPort || (autoconfig?.detected ? String(autoconfig.smtp?.port ?? "465") : "465");
  const effectiveSmtpSecure = form.smtpSecure;

  const isDetectionFailed = !!(autoconfig && !autoconfig.detected && debouncedEmail.includes("@") && debouncedEmail.includes("."));
  const isAdvancedOpen = showAdvanced || isDetectionFailed;

  const update = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!effectiveImapHost || !effectiveSmtpHost) {
      setShowAdvanced(true);
      toast.error("Veuillez spécifier les serveurs IMAP et SMTP");
      return;
    }

    createAccount.mutate(
      {
        emailAddress: form.emailAddress,
        displayName: form.displayName || undefined,
        imap: {
          host: effectiveImapHost,
          port: Number(effectiveImapPort) || 993,
          secure: effectiveImapSecure,
          username: effectiveImapUsername || form.emailAddress,
          password: form.password,
        },
        smtp: {
          host: effectiveSmtpHost,
          port: Number(effectiveSmtpPort) || 465,
          secure: effectiveSmtpSecure,
        },
      },
      {
        onSuccess: (account) => {
          toast.success("Compte ajouté avec succès");
          onOpenChange(false);
          setForm(INITIAL_FORM);
          setShowAdvanced(false);
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
          <DialogTitle>Ajouter un compte de messagerie</DialogTitle>
        </DialogHeader>

        {/* Connexion OAuth rapide (Google & Microsoft) */}
        <OAuthQuickButtons />

        <div className="my-2 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou avec vos identifiants</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Adresse email */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              value={form.emailAddress}
              onChange={(e) => update("emailAddress", e.target.value)}
              placeholder="vous@exemple.com"
              required
            />

            <AutoconfigBadge
              loading={autoconfigLoading}
              detected={!!autoconfig?.detected}
              source={autoconfig?.source}
              imapHost={effectiveImapHost}
              imapPort={effectiveImapPort}
              smtpHost={effectiveSmtpHost}
              smtpPort={effectiveSmtpPort}
              hasTypedDomain={!!(autoconfig && !autoconfig.detected && debouncedEmail.includes("@"))}
            />
          </div>

          {/* Nom d'affichage (optionnel) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">Nom d&apos;affichage (optionnel)</Label>
            <Input
              id="displayName"
              value={form.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              placeholder="Ex: Alex Dupont ou Pro"
            />
          </div>

          {/* Mot de passe unique */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="••••••••••••"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                title={showPassword ? "Masquer" : "Afficher"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Bouton pour déplier/replier les paramètres avancés IMAP / SMTP */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!isAdvancedOpen)}
              className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground py-1.5 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5" />
                Paramètres du serveur (Avancé)
              </span>
              {isAdvancedOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>

            {/* Accordéon avec les champs serveur */}
            {isAdvancedOpen && (
              <div className="pt-2">
                <ServerSettingsAccordion
                  imapHost={effectiveImapHost}
                  imapPort={effectiveImapPort}
                  imapSecure={effectiveImapSecure}
                  imapUsername={effectiveImapUsername}
                  smtpHost={effectiveSmtpHost}
                  smtpPort={effectiveSmtpPort}
                  smtpSecure={effectiveSmtpSecure}
                  onUpdate={update}
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createAccount.isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={createAccount.isPending} className="cursor-pointer">
              {createAccount.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Connexion...
                </>
              ) : (
                "Ajouter le compte"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
