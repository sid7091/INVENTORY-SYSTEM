import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page narrow empty-state">
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Not found</h1>
      <p>This slab may have been sold or removed.</p>
      <Link className="btn" href="/">
        Back to the library
      </Link>
    </main>
  );
}
