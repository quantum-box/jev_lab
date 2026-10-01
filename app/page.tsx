'use client';
import {useState} from 'react';
import Link from 'next/link';
import {categories,pocs, type Category} from '../lib/pocs';
import {lensBySlug} from '../lib/jev-lens';
import {PocCard} from '../components/PocCard';
import {JevPipeline} from '../components/JevPipeline';
const featured=['accounting-category','incident-triage','tool-call-check','tiny-world'].map(s=>lensBySlug(s)!);
export default function Home(){const [category,setCategory]=useState<'All'|Category>('All'); const [demo,setDemo]=useState(0); const filtered=category==='All'?pocs:pocs.filter(p=>p.category===category); return <>
<section className="home-hero"><div className="eyebrow">Jev = 判断AI</div><h1>チャットではなく、<br/>「判断」を返すAI。</h1><p>Jevに<b>状況（state）</b>と<b>型付きの問い（question）</b>を渡すと、決めておいた選択肢の中から<b>確率つきで</b>答えを返します。このラボの25アプリは、すべてこの1つの仕組みの使い回しです。</p></section>
<section className="demo panel" aria-labelledby="demo-title"><div className="demo-head"><h2 id="demo-title">見てみる：同じ仕組みで、4つのちがう判断</h2><div className="toolbar" role="tablist">{featured.map((l,i)=><button key={l.slug} role="tab" aria-selected={demo===i} className={`chip ${demo===i?'active':''}`} onClick={()=>setDemo(i)}>{l.title}</button>)}</div></div><JevPipeline key={featured[demo].slug} lens={featured[demo]}/><p className="demo-foot">図解用の例示値（固定データ）です。実際のJev出力は <Link href="/playground">Playground</Link> の Jev live で確かめられます。</p></section>
<section className="why" aria-labelledby="why-title"><h2 id="why-title" className="sr-only">Jevの強み</h2>
<article className="why-card"><div className="why-visual why-vs"><div><span>ルール</span><b className="ng">会議費</b></div><div><span>Jev</span><b className="ok">交際費</b></div></div><h3>1. 文脈で判断する</h3><p>キーワードではなく状況全体を見ます。各アプリの図解では、キーワードや固定条件のルールが取りこぼすケースを並べています。</p></article>
<article className="why-card"><div className="why-visual why-dist"><span style={{height:'46%'}} className="on"/><span style={{height:'38%'}}/><span style={{height:'16%'}}/><i title="しきい値"/></div><h3>2. 迷いが数字で見える</h3><p>答えは1つでも、確率の割れ方が返ります。「70%未満は人が確認」のように、自動化する範囲を自分で決められます。</p></article>
<article className="why-card"><div className="why-visual why-type"><div className="chat">たぶん交際費だと思いますが、状況によっては…</div><code>{'{ "choice": "entertainment", "probabilities": {…} }'}</code></div><h3>3. 答えの形が壊れない</h3><p>チャットの文章ではなく、渡した選択肢のキーだけが返ります。そのままプログラムの分岐に使えます。</p></article>
</section>
<section><div className="section-title"><h2>25のアプリ — それぞれJevに何を聞いているか</h2><span className="count">{filtered.length} / {pocs.length} experiments</span></div><div className="toolbar" aria-label="Filter by category">{categories.map(c=><button key={c} className={`chip ${category===c?'active':''}`} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="grid">{filtered.map(p=><PocCard key={p.slug} poc={p}/>)}</div></section>
<div className="data-note">Replay / Rule は外部APIを呼びません。ゲーム・音声PoCは代替表示で利用でき、視覚・聴覚に依存しない説明を併記します。</div></>}
