import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PreviewBanner from "@/components/PreviewBanner";
import SiteView from "@/components/SiteView";
import { verifyDraftToken } from "@/lib/preview";
import { getBusiness } from "@/lib/store";

export const dynamic = "force-dynamic"; // content is edited live by the owner

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBusiness(slug);
  if (!b || !b.published) return { title: "MH Launchpad", robots: { index: false } };
  return { title: `${b.content.businessName} | MH Launchpad`, description: b.content.tagline.en };
}

export default async function SitePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const business = await getBusiness(slug);
  if (!business) notFound();

  if (!business.published) {
    // Drafts and hidden sites are visible only to someone holding the private draft link.
    if (!verifyDraftToken(preview, slug)) notFound();
    return (
      <>
        <PreviewBanner slug={slug} token={preview!} />
        <SiteView business={business} preview />
      </>
    );
  }
  return <SiteView business={business} />;
}
