import Projects from '@/app/(workspace)/app/projects/[id]/edit/page';
import Clients from '@/app/(workspace)/app/clients/[id]/edit/page';
import Payments from '@/app/(workspace)/app/payments/[id]/edit/page';
import Expenses from '@/app/(workspace)/app/expenses/[id]/edit/page';
import References from '@/app/(workspace)/app/[section]/[id]/edit/page';
export default async function EditModal(props:{params:Promise<{section:string;id:string}>}){
 const {section}=await props.params;
 if(section==='projects')return <Projects params={props.params}/>;
 if(section==='clients')return <Clients params={props.params}/>;
 if(section==='payments')return <Payments params={props.params}/>;
 if(section==='expenses')return <Expenses params={props.params}/>;
 return <References params={props.params}/>;
}
