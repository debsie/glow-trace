import { formatZar, PLANS } from "@/lib/plans";
import type { Faq } from "@/lib/seo";

/**
 * Pages that each answer one search directly. The first paragraph is written to be quoted on its
 * own by search engines and AI assistants; keep it factual, specific and under 60 words.
 */
export type AnswerPage = {
  path: "/skin-analysis-app" | "/makeup-artist-app";
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  answer: string;
  steps: { title: string; body: string }[];
  points: string[];
  faqs: Faq[];
  cta: { label: string; to: "/login" | "/pricing" };
};

export const ANSWER_PAGES: AnswerPage[] = [
  {
    path: "/skin-analysis-app",
    title: "Skin Analysis App for South Africa — Free Skin, Hair & Nail Check-Ins | Glowtrace",
    description:
      "Glowtrace is a skin analysis app that scores redness, texture, hydration and tone from one photo, on your phone, and builds a routine from products you already own. Free to start.",
    eyebrow: "Skin analysis app",
    h1: "A skin analysis app that works on your phone, not in the cloud",
    answer: `Glowtrace is a skin, hair and nail analysis app built for South Africa. Take one photo and it scores redness, texture, hydration and even tone from 0 to 100, on your own device, without uploading the photo. It then builds a morning and evening routine from the products already on your shelf. Free for 2 check-ins a month; Glow Pro is ${formatZar(PLANS.pro.monthlyZar)} a month.`,
    steps: [
      { title: "Take a photo", body: "Close up, in natural light. Skin, hair or nails." },
      { title: "Read your scores", body: "Each indicator from 0 to 100, with what it means." },
      {
        title: "Follow the routine",
        body: "Matched to what you own, with DIY options when something's missing.",
      },
      { title: "Track progress", body: "Compare scans over weeks and see what changed." },
    ],
    points: [
      "Photos never leave your phone",
      "Prices in rands, no dollar conversions",
      "Works offline once installed",
      "A care agent that checks which products clash",
    ],
    faqs: [
      {
        question: "Is there a free skin analysis app?",
        answer: `Yes. Glowtrace's free plan gives you 2 skin, hair or nail check-ins a month, morning and evening routines and DIY remedies, with no card required. Unlimited check-ins cost ${formatZar(PLANS.pro.monthlyZar)} a month.`,
      },
      {
        question: "How does a skin analysis app work?",
        answer:
          "Glowtrace measures colour and texture in your photo: redness from the red-green colour axis, texture from how much brightness changes across the surface, hydration from highlights and flaky patches, and tone from how evenly colour is spread. The same photo always gives the same result.",
      },
      {
        question: "Is my photo uploaded?",
        answer:
          "No. The analysis runs in your browser on your device. Your photo is never sent to a server.",
      },
      {
        question: "Can an app diagnose skin conditions?",
        answer:
          "No, and Glowtrace doesn't try to. It gives cosmetic wellness indicators. For anything that worries you, such as a changing mole, see a doctor or dermatologist.",
      },
    ],
    cta: { label: "Request Beta Access", to: "/login" },
  },
  {
    path: "/makeup-artist-app",
    title: "Makeup Artist App for Bridal & Event MUAs in South Africa | Glowtrace MUA Studio",
    description:
      "MUA Studio keeps your clients' skin notes, prep plans and event lookbooks in one place, with client sign-off from a private link. Built for South African bridal and event makeup artists.",
    eyebrow: "Makeup artist app",
    h1: "The makeup artist app for bridal and event bookings",
    answer: `Glowtrace MUA Studio is a client management app for freelance makeup artists. Keep each client's skin scans, prep notes and event lookbook in one place, choose lighting presets, and get the client's sign-off from a private link. It costs ${formatZar(PLANS.studio.monthlyZar)} a month for up to ${PLANS.studio.limits.activeClients} active clients, priced in rands for South African artists.`,
    steps: [
      { title: "Add the client", body: "Name, contact, skin type and notes in seconds." },
      { title: "Scan their skin", body: "Prep is based on the latest reading, not a guess." },
      { title: "Build the look", body: "Skin prep, base, hair and nails, with lighting presets." },
      { title: "Get sign-off", body: "The client approves from a private link before the day." },
    ],
    points: [
      `${PLANS.studio.limits.activeClients} active clients; archive finished bookings to free a spot`,
      "Daylight, studio flash and candlelight presets",
      "Read-only client lookbook with one-tap approval",
      "Includes everything in Glow Pro for your own skin",
    ],
    faqs: [
      {
        question: "What is the best app for makeup artists to manage clients?",
        answer: `For bridal and event artists, the essentials are client skin notes, a look plan per event and client approval before the day. Glowtrace MUA Studio does all three for ${formatZar(PLANS.studio.monthlyZar)} a month and is priced in rands for South Africa.`,
      },
      {
        question: "How do I send a bridal client their makeup look for approval?",
        answer:
          "In MUA Studio, build the lookbook (skin prep, base, hair, nails and lighting) and send the client their private link. They review it and approve with one tap, and you see the approval immediately.",
      },
      {
        question: "Can I use it for more than 5 clients?",
        answer:
          "Five clients can be active at once. Archive a client after their event and the spot opens again; archived clients keep their notes and lookbooks.",
      },
    ],
    cta: { label: "See MUA Studio Pricing", to: "/pricing" },
  },
];
