import Link from 'next/link';
import type { Poc } from '../lib/pocs';
export function PocCard({poc}:{poc:Poc}){return <Link href={`/pocs/${poc.slug}`} className="card"><div className="card-head"><span className="eyebrow">{poc.category}</span><span className={`badge ${poc.status==='coming-soon'?'soon':''}`}>{poc.status==='foreground'?'Replay ready':'Coming soon'}</span></div><h3>{poc.title}</h3><p>{poc.description}</p><div className="card-foot"><span>{poc.decisionType}</span><span>→</span></div></Link>}
