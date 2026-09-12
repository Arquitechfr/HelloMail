"use client";

import { useState } from "react";
import {
  usePgpUserKeys,
  useDeletePgpUserKey,
  usePgpContactKeys,
  useDeletePgpContactKey,
} from "@/lib/queries/pgp";
import { useAccounts } from "@/lib/queries/accounts";
import { formatFingerprint } from "@/lib/pgp/pgpCrypto";
import { Button } from "@/components/ui/button";
import {
  KeyRound,
  ShieldCheck,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  User,
} from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import type { PgpKeyInfo } from "@/lib/api-types";

const PgpGenerateKeyDialog = dynamic(
  () => import("./PgpGenerateKeyDialog").then((mod) => mod.PgpGenerateKeyDialog),
  { ssr: false },
);

const PgpImportKeyDialog = dynamic(
  () => import("./PgpImportKeyDialog").then((mod) => mod.PgpImportKeyDialog),
  { ssr: false },
);

export function PgpKeyManager() {
  const { data: myKeys = [], isLoading: loadingMyKeys } = usePgpUserKeys();
  const { data: contactKeys = [] } = usePgpContactKeys();
  const deleteUserKey = useDeletePgpUserKey();
  const deleteContactKey = useDeletePgpContactKey();
  const { data: accounts } = useAccounts();

  // Modales
  const [generateOpen, setGenerateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const copyPublicKey = (armoredPublicKey: string) => {
    navigator.clipboard.writeText(armoredPublicKey);
    toast.success("Clé publique copiée dans le presse-papier");
  };

  const downloadPublicKey = (key: PgpKeyInfo) => {
    const blob = new Blob([key.armoredPublicKey], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${key.email}-public-key.asc`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      {/* Mes clés personnelles */}
      <div className="rounded-lg border border-border bg-card/60 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <h3 className="text-sm font-bold font-display text-foreground">
              Mes clés OpenPGP personnelles
            </h3>
          </div>
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="text-xs gap-1 h-7"
            >
              <Upload className="size-3" />
              Importer
            </Button>
            <Button
              size="xs"
              onClick={() => setGenerateOpen(true)}
              className="text-xs gap-1 h-7"
            >
              <Plus className="size-3" />
              Générer une clé
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Le chiffrement OpenPGP protège vos messages de bout en bout. Votre clé privée ne quitte jamais votre appareil en clair.
        </p>

        {loadingMyKeys ? (
          <div className="py-4 text-center text-xs text-muted-foreground">Chargement des clés...</div>
        ) : myKeys.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground italic">
            Aucune clé OpenPGP configurée. Générez ou importez votre paire de clés pour chiffrer vos communications.
          </div>
        ) : (
          <div className="space-y-3">
            {myKeys.map((key) => (
              <div key={key.fingerprint} className="rounded-lg border bg-muted/20 p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">{key.email}</span>
                      {key.name && <span className="text-xs text-muted-foreground">({key.name})</span>}
                      <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <ShieldCheck className="size-2.5" /> {key.algorithm}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground tracking-wider select-all">
                      {formatFingerprint(key.fingerprint)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title="Copier la clé publique"
                      onClick={() => copyPublicKey(key.armoredPublicKey)}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title="Télécharger la clé publique (.asc)"
                      onClick={() => downloadPublicKey(key)}
                    >
                      <Download className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive/80 hover:text-destructive"
                      title="Supprimer la clé"
                      onClick={() => deleteUserKey.mutate(key.keyId)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clés des correspondants */}
      <div className="rounded-lg border border-border bg-card/60 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-bold font-display text-foreground">
              Clés publiques des correspondants ({contactKeys.length})
            </h3>
          </div>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="text-xs gap-1 h-7"
          >
            <Plus className="size-3" />
            Ajouter une clé publique
          </Button>
        </div>

        {contactKeys.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Aucune clé de contact enregistrée. Ajoutez les clés publiques de vos correspondants pour leur envoyer des messages chiffrés.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {contactKeys.map((cKey) => (
              <div key={cKey.fingerprint} className="flex items-center justify-between border rounded-md p-2.5 bg-muted/10 text-xs">
                <div className="min-w-0 pr-2">
                  <div className="font-medium truncate">{cKey.email}</div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">
                    {cKey.keyId}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6 text-destructive/80 shrink-0"
                  onClick={() => deleteContactKey.mutate(cKey.keyId)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modale de génération de clé */}
      <PgpGenerateKeyDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        defaultEmail={accounts?.[0]?.emailAddress || ""}
      />

      {/* Modale d'import de clé */}
      <PgpImportKeyDialog
        open={importOpen}
        onOpenChange={setImportOpen}
      />
    </div>
  );
}
