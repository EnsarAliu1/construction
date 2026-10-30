import {modalPage} from '@/components/workspace/modal-page';
import { ReferenceCreate } from "@/features/references/screens";
export const metadata = { title: "E dhënë e re referuese" };
async function NewReferencePage({ params }: { params: Promise<{ section: string }> }) { return <ReferenceCreate section={(await params).section} />; }

export default modalPage(NewReferencePage);
