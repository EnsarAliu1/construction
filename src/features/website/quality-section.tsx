import {AboutMotion} from './about-motion';

const values=[
 {title:'Punë cilësore',body:'Kujdes në përzgjedhjen e materialeve dhe në realizimin e çdo detaji.'},
 {title:'Siguri',body:'Vëmendje ndaj ekipit, kantierit dhe organizimit të çdo faze të punës.'},
 {title:'Transparencë',body:'Kosto të qarta dhe komunikim i hapur për ecurinë e punimeve.'},
 {title:'Besueshmëri',body:'Planifikim i përgjegjshëm dhe përkushtim ndaj angazhimeve të marra.'},
];

export function QualitySection(){
 return <section className="quality-section" aria-labelledby="quality-heading"><AboutMotion><div className="showcase-container quality-grid">
  <div className="quality-scene" data-about-reveal aria-hidden="true"><div className="quality-blocks"><div className="quality-block quality-block-large"/><div className="quality-block quality-block-medium"/><div className="quality-block quality-block-small"/></div><span className="quality-ground"/></div>
  <div><div data-about-reveal><p className="showcase-eyebrow"><span aria-hidden="true"/>PSE TË NA ZGJIDHNI</p><h2 id="quality-heading">Matim me kujdes.<br/>Ndërtojmë me besim.</h2></div>
   <div className="quality-values">{values.map((value,index)=><article data-about-reveal key={value.title}><span className="quality-index" aria-hidden="true">0{index+1}</span><h3>{value.title}</h3><p>{value.body}</p></article>)}</div>
  </div>
 </div></AboutMotion></section>;
}
