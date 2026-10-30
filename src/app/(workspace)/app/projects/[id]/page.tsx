import {ProjectDetails} from '@/features/projects/project-details';
export const metadata={title:'Punishtja'};
export default async function ProjectPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 return <ProjectDetails id={(await params).id} params={await searchParams}/>;
}
