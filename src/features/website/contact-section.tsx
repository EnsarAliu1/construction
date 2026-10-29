import {dictionaries} from '@/i18n/dictionaries';
import {AboutMotion} from './about-motion';

/** Delivery remains disabled until an approved delivery channel and privacy policy exist. */
export function ContactSection(){
 const copy=dictionaries.sq;
 return <section id="kontakti" className="contact-section" aria-labelledby="contact-heading" tabIndex={-1}><AboutMotion><div className="showcase-container contact-layout">
  <div className="contact-intro" data-about-reveal><p className="showcase-eyebrow"><span aria-hidden="true"/>KONTAKTI</p><h2 id="contact-heading">Ndërtojmë<br/>së bashku.</h2><p className="contact-lead">Na tregoni idenë tuaj dhe le t’i japim formë hapit të radhës.</p></div>
  <div className="contact-form-panel" data-about-reveal>
   <fieldset className="contact-form-fields" disabled aria-describedby="contact-note"><legend className="sr-only">Formulari i kontaktit</legend>
    <div className="contact-fields-grid">
     <div className="contact-field"><label htmlFor="contact-name">Emri <span aria-hidden="true">*</span></label><input id="contact-name" name="name" autoComplete="name" required/></div>
     <div className="contact-field"><label htmlFor="contact-email">Emaili <span aria-hidden="true">*</span></label><input id="contact-email" name="email" type="email" autoComplete="email" required/></div>
     <div className="contact-field"><label htmlFor="contact-phone">Telefoni</label><input id="contact-phone" name="phone" type="tel" autoComplete="tel"/></div>
     <div className="contact-field"><label htmlFor="contact-project-type">Lloji i projektit <span aria-hidden="true">*</span></label><select id="contact-project-type" name="projectType" defaultValue="" required><option value="" disabled>Zgjidhni...</option><option value="residential">Ndërtim banimi</option><option value="commercial">Ndërtim komercial</option><option value="renovation">Renovim</option><option value="architecture">Projektim arkitektonik</option><option value="other">Tjetër</option></select></div>
     <div className="contact-field contact-field-message"><label htmlFor="contact-message">Mesazhi <span aria-hidden="true">*</span></label><textarea id="contact-message" name="message" rows={5} required/></div>
    </div>
    <button className="contact-submit" type="button" disabled>{copy.submit}<span aria-hidden="true">→</span></button>
   </fieldset>
   <p id="contact-note" className="contact-delivery-note">{copy.contactNote}</p>
  </div>
 </div></AboutMotion></section>;
}
