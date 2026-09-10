import { redirect } from "next/navigation";

export default function RulesRedirectPage() {
  redirect("/mail/settings?section=rules");
}
