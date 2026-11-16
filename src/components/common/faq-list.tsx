import { ChevronDown } from "lucide-react";

import type { Faq } from "@/lib/seo";

/** Questions as native disclosure rows: answers stay in the page for search engines, no script needed. */
export const FaqList = ({ faqs }: { faqs: readonly Faq[] }) => (
  <div className="surface divide-y divide-border overflow-hidden">
    {faqs.map((faq, index) => (
      <details key={faq.question} open={index === 0} className="group">
        <summary className="flex min-h-[64px] items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-secondary">
          <h3 className="font-display text-lg font-semibold text-foreground">{faq.question}</h3>
          <ChevronDown
            className="chevron h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300"
            aria-hidden="true"
          />
        </summary>
        <p className="details-body px-5 pb-5 text-sm text-muted-foreground">{faq.answer}</p>
      </details>
    ))}
  </div>
);
