import type { Metadata } from "next";
import { AccountView } from "@/components/account/account-view";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your account, back up your wedding plan, and share it with your partner and vendors."
};

export default function AccountPage() {
  return <AccountView />;
}
