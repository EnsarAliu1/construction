import Image from 'next/image';
import Link from 'next/link';
import type {ReactNode} from 'react';

export function AuthFrame({children,verification=false}:{children:ReactNode;verification?:boolean}){
 return <main className={`auth-page${verification?' auth-page--verification':''}`}>
  <div className="auth-background-mark" aria-hidden="true"><Image src="/logos/construction.png" alt="" width={600} height={600}/></div>
  <div className="auth-topline"><Link href="/sq" className="auth-home"><span aria-hidden="true">←</span> Kthehu në website</Link><span>HAPËSIRA E PUNËS <i aria-hidden="true"/> QASJE PRIVATE</span></div>
  <div className="auth-composition">
   <aside className="auth-story" aria-label="Construction">
    <Image src="/images/hero-architecture.jpg" alt="" fill sizes="(max-width: 900px) 1px, 45vw" className="auth-story-photo"/>
    <div className="auth-story-grid" aria-hidden="true"/>
    <div className="auth-story-signature"><span>Construction</span><span>NGA IDEJA TE NDËRTIMI</span></div>
    <div className="auth-story-content"><span className="auth-story-kicker">NJË VEND PËR ÇDO DETAJ</span><h2>Qartësi<br/>në çdo<br/><em>hap.</em></h2><p>Planet, njerëzit dhe puna juaj.<br/>Në një hapësirë të përbashkët.</p></div>
    <div className="auth-story-baseline"><span>VIZION. SAKTËSI. REALIZIM.</span><span className="auth-story-line" aria-hidden="true"/></div>
   </aside>
   <section className="auth-panel" aria-labelledby="login-title">
    <Link className="auth-logo" href="/sq" aria-label="Construction — Kryefaqja"><Image src="/logos/construction.png" alt="" width={512} height={581} sizes="42px" preload/><span>Construction<small>HAPËSIRA E PUNËS</small></span></Link>
    <ol className="auth-steps" aria-label="Hapat e hyrjes"><li aria-current={!verification?'step':undefined}><span>01</span> Llogaria</li><li aria-current={verification?'step':undefined}><span>02</span> Verifikimi</li></ol>
    {children}
   </section>
  </div>
  <footer className="auth-footer"><span>© 2026 Construction</span><span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>Hapësirë private. Qasje e kontrolluar.</span></footer>
 </main>;
}
