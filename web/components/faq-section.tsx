import { JsonLd } from "@/components/json-ld";
import { faqJsonLd } from "@/lib/seo";
import type { Faq } from "@/lib/seo-content";

/** Visible FAQ and its FAQPage JSON-LD come from the same array, so they cannot drift apart. */
export function FaqSection({ items }: { items: Faq[] }) {
 // Collapsed by default: the text stays in the DOM and matches the FAQPage JSON-LD.
 return <section aria-labelledby="faq-heading">
  <JsonLd data={faqJsonLd(items)}/>
  <details className="group rounded-xl border border-navy-soft/20 bg-surface p-4">
   <summary className="flex min-h-11 cursor-pointer items-center"><h2 id="faq-heading" className="text-lg font-bold">Câu hỏi thường gặp</h2></summary>
   <dl className="mt-3 space-y-4">{items.map(item => <div key={item.question}><dt className="font-semibold">{item.question}</dt><dd className="mt-1 leading-relaxed text-navy-soft">{item.answer}</dd></div>)}</dl>
  </details>
 </section>;
}
