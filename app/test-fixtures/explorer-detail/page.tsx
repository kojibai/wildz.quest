import {notFound} from "next/navigation";
import {ExplorerDetailFixture} from "@/features/play/ExplorerDetailFixture";
export default function Page(){
  if(process.env.NODE_ENV!=="development")notFound();
  return <ExplorerDetailFixture/>;
}
