import {cents} from './money';
/** Visual basis points only; monetary values retain their exact decimal strings. */
export function financialProgress(paid:string,value:string){const total=cents(value);if(total===BigInt(0))return 0;const ratio=cents(paid)*BigInt(10000)/total;return Number(ratio>BigInt(10000)?BigInt(10000):ratio);}
