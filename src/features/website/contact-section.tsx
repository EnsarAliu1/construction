"use client";
import {useState,useSyncExternalStore} from 'react';
import {dictionaries} from '@/i18n/dictionaries';
import {AboutMotion} from './about-motion';
const subscribe=()=>()=>{};

/** Editable draft; delivery is not configured and never reports a false success. */
export function ContactSection(){
 const copy=dictionaries.sq;
 const [attempted,setAttempted]=useState(false);
 const interactive=useSyncExternalStore(subscribe,()=>true,()=>false);
 return <section id="kontakti" className="contact-section" aria-labelledby="contact-heading" tabIndex={-1}><AboutMotion><div className="showcase-container contact-layout">
  <div className="contact-intro" data-about-reveal><p className="showcase-eyebrow"><span aria-hidden="true"/>KONTAKTI</p><h2 id="contact-heading">Ndërtojmë<br/>së bashku.</h2><p className="contact-lead">Na tregoni idenë tuaj dhe le t’i japim formë hapit të radhës.</p></div>
  <div className="contact-form-panel" data-about-reveal>
   <form aria-label="Formulari i kontaktit" aria-describedby="contact-note" onSubmit={event=>{event.preventDefault();setAttempted(true);}}>
   <fieldset className="contact-form-fields" disabled={!interactive}><legend className="sr-only">Të dhënat e kontaktit</legend>
    <div className="contact-fields-grid">
     <div className="contact-field"><label htmlFor="contact-name">Emri <span aria-hidden="true">*</span></label><input id="contact-name" name="name" autoComplete="name" required/></div>
     <div className="contact-field"><label htmlFor="contact-email">Emaili <span aria-hidden="true">*</span></label><input id="contact-email" name="email" type="email" autoComplete="email" required/></div>
     <div className="contact-field"><label htmlFor="contact-phone">Telefoni</label><input id="contact-phone" name="phone" type="tel" autoComplete="tel"/></div>
     <div className="contact-field"><label htmlFor="contact-project-type">Lloji i klientit <span aria-hidden="true">*</span></label><select id="contact-project-type" name="clientType" defaultValue="" required><option value="" disabled>Zgjidhni...</option><option value="business">Biznes</option><option value="individual">Individual</option></select></div>
     <div className="contact-field contact-field-message"><label htmlFor="contact-message">Mesazhi <span aria-hidden="true">*</span></label><textarea id="contact-message" name="message" rows={5} required/></div>
    </div>
    <button className="contact-submit" type="submit">{copy.submit}<span aria-hidden="true">→</span></button>
   </fieldset>
   <p className="contact-submit-status" role="status" aria-live="polite">{attempted?'Kërkesa nuk u dërgua. Shërbimi i dërgimit ende nuk është lidhur; të dhënat tuaja mbeten vetëm në këtë formular.':''}</p>
   </form>
   <noscript><p>Aktivizoni JavaScript për të plotësuar formularin.</p></noscript>
   <p id="contact-note" className="contact-delivery-note">{copy.contactNote}</p>
  </div>
 </div></AboutMotion></section>;
}
