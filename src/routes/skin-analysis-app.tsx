import { createFileRoute } from "@tanstack/react-router";

import { AnswerPageView } from "@/components/seo/answer-page-view";
import { ANSWER_PAGES } from "@/content/answer-pages";
import { breadcrumbSchema, faqSchema, pageHead, softwareApplicationSchema } from "@/lib/seo";

const page = ANSWER_PAGES.find((item) => item.path === "/skin-analysis-app")!;

export const Route = createFileRoute("/skin-analysis-app")({
  head: () =>
    pageHead({
      title: page.title,
      description: page.description,
      path: page.path,
      schema: [
        softwareApplicationSchema(),
        faqSchema(page.faqs),
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: page.eyebrow, path: page.path },
        ]),
      ],
    }),
  component: () => <AnswerPageView page={page} />,
});
