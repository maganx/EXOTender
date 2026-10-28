import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap auth">
      <div className="auth-card">
        <h1>404</h1>
        <p>Ukurasa huu haupo. / This page does not exist.</p>
        <Link className="btn gold" href="/app">
          Tenda Desk
        </Link>
      </div>
    </main>
  );
}
