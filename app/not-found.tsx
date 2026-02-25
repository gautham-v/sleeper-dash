import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-base-bg flex flex-col items-center justify-center px-4 text-white">
      <div className="text-center max-w-sm space-y-4">
        <div className="text-6xl">🏈</div>
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="text-gray-400 text-sm">
          This page doesn&apos;t exist or the league ID is invalid.
        </p>
        <Link
          href="/"
          className="inline-block mt-2 bg-white text-black font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-100 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
