import { redirect } from "next/navigation";

export default function ContactsRedirectPage() {
  redirect("/mail/settings?section=contacts");
}
