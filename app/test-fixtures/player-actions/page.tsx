import {notFound} from 'next/navigation';
import PlayerActionsBrowserFixture from '@/features/play/PlayerActionsBrowserFixture';
export default function PlayerActionsFixturePage(){if(process.env.NODE_ENV==='production')notFound();return <PlayerActionsBrowserFixture/>;}
