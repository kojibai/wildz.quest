import {notFound} from 'next/navigation';
import Probe from './probe';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <Probe/>;}
