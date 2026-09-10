"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useContacts, useCreateContact, useDeleteContact } from "@/lib/queries/contacts";
import { useUIStore } from "@/lib/stores/uiStore";
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
import { Loader2, Plus, Trash2, Users, Mail, Phone, Send } from "lucide-react";
import { toast } from "sonner";

export function ContactsManager() {
  const router = useRouter();
  const { data, isLoading } = useContacts();
  const contacts = data?.contacts ?? [];
  const createContact = useCreateContact();
  const deleteContact = useDeleteContact();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    createContact.mutate(
      { name, email, phone: phone || undefined },
      {
        onSuccess: () => {
          toast.success("Contact ajouté");
          setShowAdd(false);
          setName("");
          setEmail("");
          setPhone("");
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : "Erreur lors de l'ajout");
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteContact.mutate(id, {
      onSuccess: () => toast.success("Contact supprimé"),
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Erreur lors de la suppression");
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="size-5" />
        </div>
        <div className="flex flex-col flex-1">
          <h3 className="text-sm font-medium">Contacts</h3>
          <p className="text-xs text-muted-foreground">
            {contacts?.length ?? 0} contact(s)
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="size-4" />
          Ajouter
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Chargement...
        </div>
      ) : !contacts || contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun contact.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-sm font-medium">{contact.name}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="size-3" />
                    {contact.email}
                  </span>
                  {contact.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" />
                      {contact.phone}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={`Écrire à ${contact.name}`}
                  onClick={() => {
                    useUIStore.getState().openCompose("new", { to: [contact.email] });
                    router.push("/mail");
                  }}
                  className="text-muted-foreground hover:text-primary"
                >
                  <Send className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Supprimer ce contact"
                  onClick={() => handleDelete(contact.id)}
                  disabled={deleteContact.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="border border-border bg-card max-w-md p-6 shadow-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle>Nouveau contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-name">Nom</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-phone">Téléphone (optionnel)</Label>
              <Input
                id="contact-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createContact.isPending}>
                {createContact.isPending ? <Loader2 className="size-4 animate-spin" /> : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
