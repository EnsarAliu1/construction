// Reuse the isolated MySQL/Edge lifecycle; never create a new container or port.
process.env.FITIMI_WORKSPACE_CHECK='1';
await import('./local-test.mjs');
