import { redirect } from "next/navigation";

export default function SecurityRedirectPage() {
  redirect("/mail/settings?section=security");
}
