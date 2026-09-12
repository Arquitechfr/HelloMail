"use client";

import { useState, useRef } from "react";
import { downloadProfileBackup } from "@/lib/queries/profile";
import { RestoreProfileDialog } from "./RestoreProfileDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Download,
  Upload,
  KeyRound,
  ShieldCheck,
  FileJson,
  Loader2,
  HardDrive,
  RefreshCcw,
} from "lucide-react";

export function ProfileBackupSection() {
  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // État de restauration
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [backupDataToRestore, setBackupDataToRestore] = useState<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (encrypt && (!password || password.length < 4)) {
      toast.error("Le mot de passe doit comporter au moins 4 caractères");
      return;
    }

    setIsExporting(true);
    try {
      await downloadProfileBackup(encrypt, encrypt ? password : undefined);
      toast.success("Sauvegarde téléchargée avec succès");
      if (encrypt) {
        setPassword("");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'export");
    } finally {
      setIsExporting(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith(".json")) {
      toast.error("Veuillez sélectionner un fichier JSON (.json ou .enc.json)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        setBackupDataToRestore(parsed);
        setRestoreModalOpen(true);
      } catch {
        toast.error("Fichier JSON corrompu ou illisible");
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Carte 1 : Sauvegarde du profil */}
      <div className="rounded-lg border border-border bg-card/60 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border/60">
          <HardDrive className="size-4 text-primary" />
          <h2 className="text-sm font-bold font-display text-foreground">
            Sauvegarder mon profil Mailora
          </h2>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Exportez l&apos;ensemble de votre configuration Mailora dans un fichier portable : règles de tri,
          modèles d&apos;emails, libellés colorés, dossiers intelligents, contacts, listes de sécurité et
          signatures de messagerie. Vos mots de passe de serveurs et clés privées ne sont jamais inclus.
        </p>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="encrypt-toggle"
              checked={encrypt}
              onChange={(e) => setEncrypt(e.target.checked)}
              className="size-4 rounded border-border text-primary focus:ring-primary"
            />
            <Label htmlFor="encrypt-toggle" className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
              <KeyRound className="size-3.5 text-muted-foreground" />
              <span>Chiffrer la sauvegarde avec un mot de passe (AES-256-GCM)</span>
            </Label>
          </div>

          {encrypt && (
            <div className="pl-6 space-y-1.5 max-w-sm">
              <Input
                type="password"
                placeholder="Définir un mot de passe de protection..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Conservez ce mot de passe précieusement. Il sera impératif pour restaurer vos données.
              </p>
            </div>
          )}

          <div className="pt-2">
            <Button
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              className="text-xs gap-1.5"
            >
              {isExporting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Génération de la sauvegarde...
                </>
              ) : (
                <>
                  <Download className="size-3.5" />
                  Télécharger mon profil (.json)
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Carte 2 : Restauration d'un profil */}
      <div className="rounded-lg border border-border bg-card/60 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border/60">
          <RefreshCcw className="size-4 text-primary" />
          <h2 className="text-sm font-bold font-display text-foreground">
            Restaurer une sauvegarde de profil
          </h2>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Importez un fichier de sauvegarde pour restaurer tout ou partie de votre environnement de travail.
          Vous pourrez prévisualiser les éléments détectés et choisir précisément les modules à réinjecter.
        </p>

        {/* Zone de Drag & Drop */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <div className="p-2.5 rounded-full bg-primary/10 text-primary">
            <Upload className="size-5" />
          </div>
          <div className="text-xs font-medium text-foreground text-center">
            Glissez-déposez votre fichier de sauvegarde ici, ou cliquez pour parcourir
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <FileJson className="size-3 text-muted-foreground" />
            <span>Fichiers supportés : .json et .enc.json</span>
          </div>
        </div>
      </div>

      {/* Carte 3 : Informations de sécurité */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4 flex items-start gap-3">
        <ShieldCheck className="size-4 text-emerald-500 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <span className="font-semibold text-foreground">Protection de la vie privée</span>
          <p className="text-muted-foreground leading-relaxed text-[11px]">
            La sauvegarde de profil est conçue pour être strictement portable et respectueuse de votre sécurité.
            Aucun mot de passe de messagerie, jeton d&apos;authentification OAuth ou clé privée n&apos;est jamais
            inclus dans le flux généré.
          </p>
        </div>
      </div>

      {/* Modale de Restauration */}
      <RestoreProfileDialog
        open={restoreModalOpen}
        onOpenChange={setRestoreModalOpen}
        backupData={backupDataToRestore}
      />
    </div>
  );
}
