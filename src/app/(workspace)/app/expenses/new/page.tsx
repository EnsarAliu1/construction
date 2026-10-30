import {modalPage} from '@/components/workspace/modal-page';
import { ExpenseCreate } from "@/features/expenses/screens";
export const metadata={title:"Regjistroni shpenzim"};
export default modalPage<{searchParams?:Promise<Record<string,string|string[]|undefined>>}>(ExpenseCreate);
