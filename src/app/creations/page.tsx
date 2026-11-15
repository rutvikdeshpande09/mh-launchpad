import type { Metadata } from "next";
import CreationsClient from "@/components/CreationsClient";

export const metadata: Metadata = { title: "My creations | MH Launchpad", robots: { index: false } };

export default function CreationsPage() {
  return <CreationsClient />;
}
