import {notFound} from "next/navigation";
import {BuilderRefinementBrowserFixture} from "@/features/play/BuilderRefinementBrowserFixture";
export default function Page(){
  if(process.env.NODE_ENV!=="development")notFound();
  return <BuilderRefinementBrowserFixture/>;
}
