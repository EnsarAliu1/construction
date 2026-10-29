/** A contrast adjustment for the clean transparent logo; preserve its real alpha. */
export function LogoFilters(){
 return <svg width="0" height="0" className="site-logo-filters" aria-hidden="true" focusable="false"><defs>
  <filter id="site-logo-light" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 .45 0 1 0 0 .45 0 0 1 0 .45 0 0 0 1 0"/></filter>
 </defs></svg>;
}
