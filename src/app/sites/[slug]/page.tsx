import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteView from "@/components/SiteView";
import { getBusiness } from "@/lib/store";

export const dynamic = "force-dynamic"; // content is edited live by the owner

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBusiness(slug);
  return b
    ? { title: `${b.content.businessName} | MH Launchpad`, description: b.content.tagline.en }
    : { title: "Business not found | MH Launchpad" };
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getBusiness(slug);
  if (!business) notFound();
  return <SiteView business={business} />;
}
