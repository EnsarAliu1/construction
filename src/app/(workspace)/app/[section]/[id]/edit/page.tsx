import {modalPage} from '@/components/workspace/modal-page';
import { ReferenceEdit } from "@/features/references/screens";
export const metadata = { title: "Ndryshoni të dhënën referuese" };
async function EditReferencePage({ params }: { params: Promise<{ section: string; id: string }> }) { const { section,id } = await params; return <ReferenceEdit {...{ section,id }} />; }

export default modalPage(EditReferencePage);
