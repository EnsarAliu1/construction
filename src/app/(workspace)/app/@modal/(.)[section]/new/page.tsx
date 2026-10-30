import Projects from '@/app/(workspace)/app/projects/new/page';
import Clients from '@/app/(workspace)/app/clients/new/page';
import Payments from '@/app/(workspace)/app/payments/new/page';
import Expenses from '@/app/(workspace)/app/expenses/new/page';
import References from '@/app/(workspace)/app/[section]/new/page';
export default async function NewModal(props:{params:Promise<{section:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {section}=await props.params;
 if(section==='projects')return <Projects/>;
 if(section==='clients')return <Clients/>;
 if(section==='payments')return <Payments searchParams={props.searchParams}/>;
 if(section==='expenses')return <Expenses searchParams={props.searchParams}/>;
 return <References params={props.params}/>;
}
