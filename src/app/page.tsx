"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PasteZone } from "@/components/PasteZone";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { loadDraft } from "@/lib/persistence";

export default function Home() {
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    loadDraft().then((d) => setHasDraft(!!d));
  }, []);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:py-20">
      <header className="flex flex-col items-start gap-3">
        <PrivacyBadge />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          screenshot<span className="text-brand">.local</span>
        </h1>
        <p className="text-slate-600">
          Paste a screenshot, annotate with arrows, boxes, text, and blur. Copy it back to your
          clipboard or download. Nothing leaves your browser.
        </p>
      </header>

      <PasteZone />

      {hasDraft && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">You have a recent session in progress.</p>
          <Link
            href="/edit"
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Open last session
          </Link>
        </div>
      )}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p>
          Open source · MIT · No network calls. Verify with DevTools → Network. Your image stays in
          this tab.
        </p>
      </footer>
    </main>
  );
}
