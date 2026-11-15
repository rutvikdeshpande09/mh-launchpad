import type { Metadata } from "next";
import { Suspense } from "react";
import EditorClient from "@/components/EditorClient";

export const metadata: Metadata = { title: "Edit your site | MH Launchpad", robots: { index: false } };

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={null}>
      <EditorClient slug={slug} />
    </Suspense>
  );
}
