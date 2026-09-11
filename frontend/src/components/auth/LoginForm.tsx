"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLogin, useVerify2FA, useWebAuthnLogin } from "@/lib/queries/auth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassPanel } from "@/components/mail/GlassPanel";
import { Mail, Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const verify2FA = useVerify2FA();
  const webauthnLogin = useWebAuthnLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorTempToken, setTwoFactorTempToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const handleWebAuthnLogin = async () => {
    if (!email.trim()) {
      toast.error("Veuillez renseigner votre email pour utiliser une Passkey");
      return;
    }
    webauthnLogin.mutate(email.trim(), {
      onSuccess: () => {
        toast.success("Connexion par clé de sécurité réussie");
        router.replace("/mail");
      },
      onError: (err) => {
        if (err instanceof ApiError) toast.error(err.message);
        else toast.error("Échec de la connexion par clé de sécurité");
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          if (data.requiresTwoFactor && data.twoFactorTempToken) {
            setTwoFactorTempToken(data.twoFactorTempToken);
          } else {
            toast.success("Connexion réussie");
            router.replace("/mail");
          }
        },
        onError: (err) => {
          if (err instanceof ApiError) toast.error(err.message);
          else toast.error("Erreur de connexion");
        },
      },
    );
  };

  const handleVerify2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorTempToken) return;
    verify2FA.mutate(
      { twoFactorTempToken, code },
      {
        onSuccess: () => {
          toast.success("Connexion réussie");
          router.replace("/mail");
        },
        onError: (err) => {
          if (err instanceof ApiError) toast.error(err.message);
          else toast.error("Code 2FA invalide");
        },
      },
    );
  };

  // Étape 2 : vérification 2FA.
  if (twoFactorTempToken) {
    return (
      <GlassPanel variant="strong" className="w-full max-w-md p-8 rounded-xl shadow-2xl border border-border">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">Vérification 2FA</h1>
          <p className="text-xs text-muted-foreground">
            {"Saisissez le code de votre application d'authentification"}
          </p>
        </div>

        <form onSubmit={handleVerify2FA} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">Code à 6 chiffres</Label>
            <Input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              required
              autoComplete="one-time-code"
              maxLength={8}
              inputMode="numeric"
            />
          </div>

          <Button type="submit" disabled={verify2FA.isPending} className="mt-2 h-10">
            {verify2FA.isPending ? <Loader2 className="size-4 animate-spin" /> : "Vérifier"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setTwoFactorTempToken(null);
              setCode("");
            }}
            className="mt-1"
          >
            Retour
          </Button>
        </form>
      </GlassPanel>
    );
  }

  // Étape 1 : login classique.
  return (
    <GlassPanel variant="strong" className="w-full max-w-md p-8 rounded-xl shadow-2xl border border-border">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
          <Mail className="size-6" />
        </div>
        <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">HelloMail</h1>
        <p className="text-xs text-muted-foreground">Connectez-vous à votre webmail moderne</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" disabled={login.isPending || webauthnLogin.isPending} className="mt-2 h-10">
          {login.isPending ? <Loader2 className="size-4 animate-spin" /> : "Se connecter"}
        </Button>

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Ou</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleWebAuthnLogin}
          disabled={webauthnLogin.isPending || login.isPending}
          className="h-10"
        >
          {webauthnLogin.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <KeyRound className="mr-2 size-4" />
          )}
          Se connecter avec une Passkey
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Créer un compte
        </Link>
      </p>
    </GlassPanel>
  );
}
