import Head from 'next/head';
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <>
      <Head>
        <title>Unauthorized - Skills Engine</title>
      </Head>
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
        <section style={{ maxWidth: '560px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', marginBottom: '12px' }}>Unauthorized</h1>
          <p style={{ marginBottom: '20px' }}>
            You do not have permission to access this page.
          </p>
          <Link href="/">Return to Home</Link>
        </section>
      </main>
    </>
  );
}
