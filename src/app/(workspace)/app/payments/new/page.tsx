import {modalPage} from '@/components/workspace/modal-page';
import { PaymentCreate } from "@/features/payments/screens";
export const metadata={title:"Përgatitni ndarjen e pagesës"};

export default modalPage<{searchParams?:Promise<Record<string,string|string[]|undefined>>}>(PaymentCreate);
