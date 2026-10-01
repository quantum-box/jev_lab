'use client';
import { usePathname } from 'next/navigation';
import { lensBySlug, routeToSlug } from '../lib/jev-lens';
import { JevPipeline } from './JevPipeline';

// Shown above every PoC screen: which typed question Jev answers inside this app.
export function JevLensStrip() {
  const parts = (usePathname() ?? '').split('/').filter(Boolean);
  if (parts[0] !== 'pocs' || parts.length !== 2) return null;
  const lens = lensBySlug(routeToSlug(parts[1]));
  if (!lens) return null;
  return <section className="lens-strip" aria-labelledby="lens-strip-title">
    <div className="lens-strip-head">
      <div><div className="eyebrow">このアプリの中で Jev がしていること</div><h2 id="lens-strip-title">{lens.when}、Jevがこの問いに答えます</h2></div>
      <span className="lens-strip-note">図解用の例示値です（固定データ）</span>
    </div>
    <JevPipeline lens={lens} compact />
  </section>;
}
