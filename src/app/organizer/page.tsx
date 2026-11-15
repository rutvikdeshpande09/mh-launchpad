import type { Metadata } from "next";
import OrganizerClient from "@/components/OrganizerClient";

export const metadata: Metadata = { title: "Website organizer | MH Launchpad", robots: { index: false } };

export default function OrganizerPage() {
  return <OrganizerClient />;
}
