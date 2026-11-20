import type {AnchorHTMLAttributes} from 'react';

/** Crosses into a separate app instance: use document navigation, with no RSC prefetch. */
export function DemoEntryLink(props:Omit<AnchorHTMLAttributes<HTMLAnchorElement>,'href'>){
 // eslint-disable-next-line @next/next/no-html-link-for-pages -- A full document navigation is required across the real/demo application boundary.
 return <a {...props} href="/demo"/>;
}
