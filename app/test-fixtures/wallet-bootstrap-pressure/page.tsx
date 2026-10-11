import {notFound} from "next/navigation";
import WalletBootstrapPressureFixture from "@/features/play/wallet/WalletBootstrapPressureFixture";
export default function Page() {if (process.env.NODE_ENV !== "development") notFound(); return <WalletBootstrapPressureFixture/>;}
