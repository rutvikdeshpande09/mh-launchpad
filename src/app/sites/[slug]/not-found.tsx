import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-6xl">🔍</p>
      <h1 className="mt-4 text-3xl font-extrabold">We couldn&apos;t find that business</h1>
      <p className="mt-2 text-muted">The link may be mistyped, or the site may not have been published yet.</p>
      <Link href="/#explore" className="btn btn-primary mt-6">Explore local businesses</Link>
    </div>
  );
}
