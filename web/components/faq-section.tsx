import { JsonLd } from "@/components/json-ld";
import { faqJsonLd } from "@/lib/seo";
import type { Faq } from "@/lib/seo-content";

/** Visible FAQ and its FAQPage JSON-LD come from the same array, so they cannot drift apart. */
export function FaqSection({ items }: { items: Faq[] }) {
 return <section aria-labelledby="faq-heading" className="space-y-3">
  <JsonLd data={faqJsonLd(items)}/>
  <h2 id="faq-heading" className="text-xl font-bold">Câu hỏi thường gặp</h2>
  <dl className="space-y-4">{items.map(item => <div key={item.question}><dt className="font-semibold">{item.question}</dt><dd className="mt-1 leading-relaxed text-navy-soft">{item.answer}</dd></div>)}</dl>
 </section>;
}
