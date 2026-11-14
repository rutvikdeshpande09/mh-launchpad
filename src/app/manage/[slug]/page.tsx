import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ManageClient from "@/components/ManageClient";
import { getBusiness } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Owner portal | MH Launchpad", robots: { index: false } };

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getBusiness(slug);
  if (!business) notFound();
  // Only public fields reach the browser; ownership is checked again on every API call.
  return <ManageClient initial={business} />;
}
