import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import PrintButton from "@/components/PrintButton";
import { getCertificate } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Volunteer Service Certificate | MH Launchpad" };

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cert = await getCertificate(id);
  if (!cert) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const verifyUrl = `${proto}://${host}/certificate/${cert.id}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 220 });
  const date = new Date(cert.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="card relative overflow-hidden border-4 border-double p-8 text-center sm:p-12" style={{ borderColor: "#b45309" }}>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand">MH Launchpad · Tech Ambassador Program</p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Certificate of Volunteer Service</h1>
        <p className="mt-8 text-muted">This certifies that</p>
        <p className="mt-2 text-4xl font-extrabold text-brand">{cert.studentName}</p>
        <p className="mx-auto mt-6 max-w-lg text-lg">
          completed a guided interview and built a free website and digital business card for{" "}
          <Link href={`/sites/${cert.businessSlug}`} className="font-bold underline">
            {cert.businessName}
          </Link>
          , a local home-based business in Mountain House.
        </p>
        <p className="mt-6 text-2xl font-bold">{cert.hours} service hours claimed</p>
        <p className="text-sm text-muted">Issued {date}</p>

        <div className="mt-8 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code to verify this certificate" className="size-28" />
          <p className="font-mono text-xs text-muted">Record ID: {cert.id}</p>
        </div>

        <div className="mx-auto mt-8 max-w-lg rounded-xl bg-amber-50 p-4 text-left text-sm text-amber-900">
          <p className="font-semibold">Status: pending advisor confirmation</p>
          <p className="mt-1">
            Scanning the QR code confirms this record exists in MH Launchpad. The hours are an estimate and are not final until a
            supervising advisor (school or Rotary club) confirms them. This certificate is not issued by Rotary International.
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <PrintButton />
        <Link href={`/sites/${cert.businessSlug}`} className="btn btn-ghost no-print">
          View the website
        </Link>
      </div>
    </div>
  );
}
