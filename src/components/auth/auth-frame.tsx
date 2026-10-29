import Image from 'next/image';
import Link from 'next/link';
import type {ReactNode} from 'react';

export function AuthFrame({children,verification=false}:{children:ReactNode;verification?:boolean}){
 return <main className="auth-page">
  <div className="auth-background-mark" aria-hidden="true"><Image src="/icon.svg" alt="" width={600} height={600}/></div>
  <div className="auth-topline"><Link href="/sq" className="auth-home">← Kthehu në website</Link><span>FITIMI CONSTRUCTION <i aria-hidden="true"/> HAPËSIRA PRIVATE</span></div>
  <div className="auth-composition">
   <aside className="auth-story" aria-label="Fitimi Construction">
    <Image src="/images/hero-architecture.jpg" alt="" fill sizes="(max-width: 900px) 1px, 45vw" className="auth-story-photo"/>
    <div className="auth-story-grid" aria-hidden="true"/>
    <div className="auth-story-content"><span className="auth-story-kicker">NGA IDEJA TE NDËRTIMI</span><h2>Çdo projekt.<br/>Një hap<br/><em>përpara.</em></h2><p>Hapësira ku planet marrin formë dhe çdo detaj gjen vendin e vet.</p></div>
    <div className="auth-story-baseline"><span aria-hidden="true">01 — FC</span><span>Themele të forta. Besim që zgjat.</span></div>
   </aside>
   <section className="auth-panel" aria-labelledby="login-title">
    <Link className="auth-logo" href="/sq" aria-label="Fitimi Construction — Kryefaqja"><Image src="/logos/fitimi-clean.png" alt="Fitimi Construction" width={2004} height={785} sizes="180px" preload/></Link>
    <ol className="auth-steps" aria-label="Hapat e hyrjes"><li aria-current={!verification?'step':undefined}><span>01</span> Llogaria</li><li aria-current={verification?'step':undefined}><span>02</span> Verifikimi</li></ol>
    {children}
    <div className="auth-panel-baseline"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg><span>Hapësirë private. Qasje e kontrolluar.</span></div>
   </section>
  </div>
  <footer className="auth-footer"><span>© 2026 Fitimi Construction</span><span>Ndërtojmë të ardhmen.</span></footer>
 </main>;
}
