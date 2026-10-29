/** Render the owner's opaque black-backed logo without changing its original file. */
export function LogoFilters(){
 return <svg width="0" height="0" className="site-logo-filters" aria-hidden="true" focusable="false"><defs>
  <filter id="site-logo-brand" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 1 1 1 0 0"/></filter>
  <filter id="site-logo-light" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 .45 0 1 0 0 .45 0 0 1 0 .45 1 1 1 0 0"/></filter>
 </defs></svg>;
}
