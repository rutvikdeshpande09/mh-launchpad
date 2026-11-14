import type { Metadata } from "next";
import OwnerClient from "@/components/OwnerClient";

export const metadata: Metadata = { title: "For business owners | MH Launchpad" };

export default function OwnerPage() {
  return <OwnerClient />;
}
