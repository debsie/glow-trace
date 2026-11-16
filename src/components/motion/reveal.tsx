import type { CSSProperties, ReactNode } from "react";

import { useInView } from "@/hooks/use-in-view";

/** Fades and lifts its children into place the first time they scroll into view. */
export const Reveal = ({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  /** Stagger in milliseconds. */
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) => {
  const { ref, inView } = useInView<HTMLElement>();
  const style = { "--reveal-delay": `${delay}ms` } as CSSProperties;
  return (
    <Tag
      // The three tags share HTMLElement; one ref type covers them.
      ref={ref as never}
      style={style}
      className={`reveal ${inView ? "is-visible" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
};
