import { Link } from "react-router-dom";

export default function NotFoundScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-black text-white">
      <h1 className="text-6xl font-bold text-yellow-300 mb-4">404</h1>
      <p className="text-white/70 mb-8 max-w-md">
        This page doesn't exist — the link you followed may be broken, or the
        page hasn't been built yet.
      </p>
      <Link
        to="/"
        className="px-6 py-3 rounded-xl bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition"
      >
        Back to Home
      </Link>
    </div>
  );
}
