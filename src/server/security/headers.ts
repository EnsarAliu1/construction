/** Static public pages retain inline Next bootstrap; private pages use per-response nonces. */
export function contentSecurityPolicy(production:boolean,nonce?:string){
 if(nonce&&!/^[A-Za-z0-9+/=]+$/.test(nonce))throw new Error("Invalid CSP nonce.");
 return ["default-src 'self'",`script-src 'self' ${nonce?`'nonce-${nonce}' 'strict-dynamic'`:"'unsafe-inline'"}${production?"":" 'unsafe-eval'"}`,"script-src-attr 'none'","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self'",`connect-src 'self'${production?"":" ws: wss:"}`,"object-src 'none'","base-uri 'none'","form-action 'self'","frame-ancestors 'none'","frame-src 'none'","manifest-src 'self'","worker-src 'self' blob:"].join("; ");
}
export const browserSecurityHeaders=[
 {key:"X-Content-Type-Options",value:"nosniff"},
 {key:"X-Frame-Options",value:"DENY"},
 {key:"Referrer-Policy",value:"no-referrer"},
 {key:"Cross-Origin-Resource-Policy",value:"same-origin"},
 {key:"Cross-Origin-Opener-Policy",value:"same-origin"},
 {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=(), publickey-credentials-create=(self), publickey-credentials-get=(self)"},
];
