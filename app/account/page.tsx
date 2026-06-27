import type { Metadata } from "next";
import { AccountView } from "@/components/account/account-view";

export const metadata: Metadata = {
  title: "Account",
  description: "Sign in to sync your wedding plan to the cloud and share it with your partner and vendors."
};

export default function AccountPage() {
  return <AccountView />;
}
