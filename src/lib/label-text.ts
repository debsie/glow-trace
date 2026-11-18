/**
 * Cleans text read from a product label by the on-device OCR into an ingredient list: keeps what
 * follows "Ingredients" (or INCI), joins broken lines and drops the usual label noise.
 */
const START = /\b(ingredients?|ingr[eé]dients|inci|composition)\s*[:.-]?/i;
const STOP = /\b(directions|how to use|warnings?|caution|made in|best before|exp\.?|batch|lot)\b/i;

export const cleanIngredientText = (raw: string): string => {
  let text = raw.replace(/\r/g, "");
  const start = START.exec(text);
  if (start) text = text.slice(start.index + start[0].length);
  const stop = STOP.exec(text);
  if (stop) text = text.slice(0, stop.index);
  return text
    .replace(/-\n(?=\w)/g, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/[|•·]/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/(, )+/g, ", ")
    .replace(/^[\s,.:;-]+|[\s,.;-]+$/g, "")
    .trim()
    .slice(0, 4000);
};
