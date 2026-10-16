import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || 'the-elevator.vercel.app'}`),
  title:'THE ELEVATOR — A short escape from the ordinary.',
  description:'Some doors change everything. An 18-second cinematic journey from a quiet luxury hallway to a city above the ordinary.',
  openGraph:{title:'THE ELEVATOR',description:'Some doors change everything. Step inside.',images:[{url:'/opengraph-image',width:1200,height:630}]},
  twitter:{card:'summary_large_image'},
};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#080d0f'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
