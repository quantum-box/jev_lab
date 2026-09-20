import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import './living-ui.css';
import './search-reranking.css';

export const metadata: Metadata = { title: 'JEV AI Decision Lab', description: '判断AI PoC gallery' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ja"><body><header className="topbar"><Link href="/" className="brand"><span className="mark">J</span><span>JEV <em>AI Decision Lab</em></span></Link><nav><Link href="/playground">Playground</Link><Link href="/runtime-lab">Runtime Lab</Link><Link href="/">Gallery</Link><Link href="/runs">Runs</Link></nav></header><main>{children}</main><footer>JEV AI Decision Lab · PoC gallery · sample/replay mode only</footer></body></html>;
}
