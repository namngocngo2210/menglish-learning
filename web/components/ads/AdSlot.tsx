import { AdUnit } from "./AdUnit";
export interface AdSlotProps { slot: "in-content" | "sidebar" | "footer"; }

export function AdSlot({ slot }: AdSlotProps) {
 const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
 const slotId = {
  "in-content": process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_CONTENT,
  sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR,
  footer: process.env.NEXT_PUBLIC_ADSENSE_SLOT_FOOTER,
 }[slot];
 // Keep a reserved, neutral placeholder in every environment when unconfigured.
 const className = "block min-h-[120px] w-full rounded-md border border-navy-soft/20 bg-surface";
 if (!client || !slotId) return <div aria-hidden="true" className={`${className} flex items-center justify-center px-5 text-sm text-navy-soft`}>Vị trí quảng cáo</div>;
 return <aside aria-label="Quảng cáo" className="min-w-0"><AdUnit client={client} slotId={slotId} className={className}/></aside>;
}
