"use client";

import { useState } from "react";
import { generatePgpKeyPair } from "@/lib/pgp/pgpCrypto";
import { useSavePgpUserKey } from "@/lib/queries/pgp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PgpGenerateKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
}

export function PgpGenerateKeyDialog({
  open,
  onOpenChange,
  defaultEmail = "",
}: PgpGenerateKeyDialogProps) {
  const saveUserKey = useSavePgpUserKey();
  const [genName, setGenName] = useState("");
  const [genEmail, setGenEmail] = useState(defaultEmail);
  const [genPassphrase, setGenPassphrase] = useState("");
  const [genType, setGenType] = useState<"ecc" | "rsa">("ecc");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genEmail.trim()) {
      toast.error("L'adresse email est requise");
      return;
    }
    setGenerating(true);
    try {
      const pair = await generatePgpKeyPair({
        name: genName.trim() || undefined,
        email: genEmail.trim().toLowerCase(),
        passphrase: genPassphrase || undefined,
        type: genType,
      });

      await saveUserKey.mutateAsync({
        name: genName.trim() || undefined,
        email: genEmail.trim().toLowerCase(),
        armoredPublicKey: pair.armoredPublicKey,
        armoredPrivateKey: pair.armoredPrivateKey,
        fingerprint: pair.fingerprint,
        keyId: pair.keyId,
        algorithm: pair.algorithm,
      });

      toast.success("Paire de clés OpenPGP générée avec succès");
      onOpenChange(false);
      setGenPassphrase("");
    } catch {
      toast.error("Erreur lors de la génération de la clé");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">
            Générer une paire de clés OpenPGP
          </DialogTitle>
          <DialogDescription className="text-xs">
            Création locale dans votre navigateur via l&apos;API Web Crypto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleGenerate} className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="gen-name" className="text-xs">
              Nom d&apos;affichage (optionnel)
            </Label>
            <Input
              id="gen-name"
              value={genName}
              onChange={(e) => setGenName(e.target.value)}
              placeholder="Ex: Alice Dupont"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gen-email" className="text-xs">
              Adresse email
            </Label>
            <Input
              id="gen-email"
              type="email"
              value={genEmail}
              onChange={(e) => setGenEmail(e.target.value)}
              required
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gen-passphrase" className="text-xs">
              Passphrase de protection (optionnelle)
            </Label>
            <Input
              id="gen-passphrase"
              type="password"
              value={genPassphrase}
              onChange={(e) => setGenPassphrase(e.target.value)}
              placeholder="Laissez vide pour aucune passphrase"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gen-type" className="text-xs">
              Algorithme cryptographique
            </Label>
            <select
              id="gen-type"
              value={genType}
              onChange={(e) => setGenType(e.target.value as "ecc" | "rsa")}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="ecc">Curve25519 (Recommandé, rapide & moderne)</option>
              <option value="rsa">RSA 4096-bit (Compatibilité historique)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={generating}>
              {generating ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
              {generating ? "Génération..." : "Générer la clé"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
