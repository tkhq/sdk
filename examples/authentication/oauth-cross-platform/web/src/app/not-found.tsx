import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
      <p className="text-sm text-gray-500">🤷 Page not found.</p>
      <Link href="/" className="text-xs text-blue-600 hover:underline">
        Go home
      </Link>
    </main>
  );
}
