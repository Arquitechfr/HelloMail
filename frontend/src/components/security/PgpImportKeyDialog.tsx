"use client";

import { useState } from "react";
import { readPgpKeyInfo } from "@/lib/pgp/pgpCrypto";
import { useSavePgpUserKey, useSavePgpContactKey } from "@/lib/queries/pgp";
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
import { toast } from "sonner";

interface PgpImportKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PgpImportKeyDialog({ open, onOpenChange }: PgpImportKeyDialogProps) {
  const saveUserKey = useSavePgpUserKey();
  const saveContactKey = useSavePgpContactKey();
  const [importText, setImportText] = useState("");
  const [importEmail, setImportEmail] = useState("");

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) {
      toast.error("Veuillez coller un bloc de clé PGP valide");
      return;
    }
    try {
      const info = await readPgpKeyInfo(importText);
      const email =
        importEmail.trim().toLowerCase() ||
        info.userIDs[0]?.match(/<(.+)>/)?.[1]?.toLowerCase() ||
        "";

      if (!email) {
        toast.error("Impossible de déterminer l'adresse email liée à cette clé");
        return;
      }

      if (info.isPrivate) {
        await saveUserKey.mutateAsync({
          email,
          armoredPublicKey: importText,
          armoredPrivateKey: importText,
          fingerprint: info.fingerprint,
          keyId: info.keyId,
          algorithm: info.algorithm,
        });
        toast.success("Clé privée OpenPGP importée");
      } else {
        await saveContactKey.mutateAsync({
          email,
          armoredPublicKey: importText,
          fingerprint: info.fingerprint,
          keyId: info.keyId,
          algorithm: info.algorithm,
        });
        toast.success("Clé publique de contact importée");
      }

      onOpenChange(false);
      setImportText("");
      setImportEmail("");
    } catch {
      toast.error("Clé OpenPGP invalide ou non reconnue");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Importer une clé OpenPGP</DialogTitle>
          <DialogDescription className="text-xs">
            Collez un bloc ASCII-armor de clé publique ou privée.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleImport} className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="import-email" className="text-xs">
              Email associé (si non inclus dans la clé)
            </Label>
            <Input
              id="import-email"
              type="email"
              value={importEmail}
              onChange={(e) => setImportEmail(e.target.value)}
              placeholder="contact@exemple.com"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="import-armor" className="text-xs">
              Bloc ASCII Armor
            </Label>
            <textarea
              id="import-armor"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              required
              placeholder="-----BEGIN PGP PUBLIC KEY BLOCK----- ..."
              className="w-full rounded-md border border-input bg-background p-2 font-mono text-[10px] leading-tight"
            />
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
            <Button type="submit" size="sm">
              Importer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
