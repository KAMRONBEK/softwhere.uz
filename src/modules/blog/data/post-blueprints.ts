import { PostFormat } from './seo-topics';

export interface PostBlueprint {
  id: PostFormat;
  name: string;
  wordRange: [number, number];
  tone: string;
  openingInstruction: string;
  structurePrompt: string;
  formattingRules: string;
  seoHint: string;
}

export const POST_BLUEPRINTS: Record<PostFormat, PostBlueprint> = {
  'cost-guide': {
    id: 'cost-guide',
    name: 'Cost / Pricing Guide',
    wordRange: [2000, 2500],
    tone: 'transparent, helpful, and direct — like a consultant giving honest advice',
    openingInstruction:
      'Start with "The short answer is $X–$Y. But the real answer depends on..." Give a quick range upfront, then explain why it varies.',
    structurePrompt: `
1. Quick answer with price range upfront
2. Factors that affect cost (with a markdown table showing Low/Mid/High tiers)
3. Detailed breakdown by project phase (discovery, design, development, testing, launch)
4. Hidden costs most people forget
5. How to reduce costs without sacrificing quality
6. Worked pricing examples (clearly framed as typical/estimated scenarios, not real client data)
7. When to invest more vs when to save
8. Call-to-action: "Get a free estimate for your project"`,
    formattingRules:
      'Use markdown tables for pricing tiers. Use bold for dollar amounts. Use blockquotes for "pro tips" on saving money. Every major section should have concrete numbers.',
    seoHint: 'Include long-tail cost keywords naturally. Answer "how much does X cost" directly in the first paragraph.',
  },

  comparison: {
    id: 'comparison',
    name: 'X vs Y Comparison',
    wordRange: [2000, 2600],
    tone: 'analytical and fair — present both sides honestly before giving a recommendation',
    openingInstruction:
      'Open with the core dilemma: "You need X, but should you go with A or B?" Frame it as a business decision, not a technical one.',
    structurePrompt: `
1. The decision context — why this comparison matters for your business
2. Option A deep dive: strengths, weaknesses, best for (use bullet lists)
3. Option B deep dive: strengths, weaknesses, best for (use bullet lists)
4. Side-by-side comparison table (features, cost, timeline, scalability, maintenance)
5. Decision framework: "Choose A if... Choose B if..." (use bold conditional statements)
6. Our recommendation and reasoning
7. Call-to-action: "Not sure which fits your case? Let's discuss"`,
    formattingRules:
      'Must include at least one comparison table. Use ### for each option. Use ✅/❌ or pros/cons lists. End with a clear verdict section.',
    seoHint: 'Target "X vs Y" keywords. Include "which is better" and "how to choose" variations.',
  },

  'how-to': {
    id: 'how-to',
    name: 'Step-by-Step How-To',
    wordRange: [2000, 2800],
    tone: 'instructional, confident, and encouraging — like a mentor walking you through a process',
    openingInstruction:
      'Start with the end result: "By the end of this guide, you will have..." Then briefly mention what you need before starting.',
    structurePrompt: `
1. What you'll achieve (outcome-first hook)
2. Prerequisites — what you need before starting
3. Step 1 through Step 5-8 (each step is an H2 with sub-steps as H3)
4. Each step includes: what to do, why it matters, common mistakes at this stage
5. Timeline expectations (how long each phase takes)
6. Troubleshooting section for common problems
7. Next steps and advanced tips
8. Call-to-action: "Need help with any step? We can take it from here"`,
    formattingRules:
      'Number all major steps as H2. Use H3 for sub-steps. Include time estimates for each step. Use blockquotes for warnings or important notes.',
    seoHint: 'Target "how to" keywords. Structure steps so they can appear as HowTo rich snippets in Google.',
  },

  listicle: {
    id: 'listicle',
    name: 'Numbered Listicle',
    wordRange: [1800, 2500],
    tone: "engaging, punchy, and scannable — respect the reader's time while delivering value",
    openingInstruction:
      'Open with a bold hook: the number itself. "There are exactly N reasons..." or "We analyzed 50+ projects and found N patterns..."',
    structurePrompt: `
1. Bold hook with the count and why it matters
2. Items 1 through N, each as an H2 with:
   - A compelling one-line summary in bold
   - 2-3 paragraphs of explanation with examples
   - A quick takeaway or action item
3. Summary section with all items as a quick-reference bullet list
4. Call-to-action related to the topic`,
    formattingRules:
      'Each item is an H2 with the number. Start each item with a bold one-liner. Keep paragraphs short (2-3 sentences). End each item with an actionable takeaway in italic.',
    seoHint: 'Use the number in the title. Include "top", "best", "reasons", "signs" keyword variations.',
  },

  faq: {
    id: 'faq',
    name: 'FAQ Article',
    wordRange: [1500, 2000],
    tone: 'conversational and helpful — like answering questions from a smart friend',
    openingInstruction:
      'Start with: "If you\'re reading this, you probably have questions about [topic]. Here are the answers to the most common ones."',
    structurePrompt: `
1. Brief intro (2-3 sentences) establishing why these questions matter
2. 8-12 questions, each as an H2 formatted as a question
3. Each answer: 2-4 paragraphs, direct and specific, no filler
4. Mix of basic and advanced questions
5. Final section: "Still have questions?" with call-to-action`,
    formattingRules:
      'Every H2 must be a question (ending with ?). Answers should start with a direct one-sentence answer, then elaborate. Use bold for key terms. This format directly maps to FAQ schema.',
    seoHint: 'Questions should match "People Also Ask" queries. Format for FAQ rich snippets in Google.',
  },

  'case-study': {
    id: 'case-study',
    name: 'Scenario Walkthrough',
    wordRange: [2000, 2800],
    tone: "storytelling and results-focused — show, don't just tell",
    openingInstruction:
      'Open with a realistic scenario, honestly framed: "Imagine a mid-size [industry] company in Tashkent facing [specific pain point]." NEVER present an invented client or invented results as a real engagement — fabricated case studies destroy trust.',
    structurePrompt: `
1. The Scenario: industry, size, and context — explicitly framed as a representative example
2. The Challenge: specific problems and pain points typical for this situation
3. The Approach: methodology, technology choices, team setup — grounded in how we actually work
4. Implementation: realistic timeline in weeks, key milestones, obstacles that typically appear
5. Expected Outcomes: what improvements such a project realistically targets (qualitative, or verified facts if provided; estimated figures clearly labeled as estimates)
6. Key Takeaways: lessons applicable to the reader's business
7. Call-to-action: "Facing a similar challenge? Let's talk"`,
    formattingRules:
      'Include a table of expected before/after improvements framed as targets, not measured results. Use bold for numbers. Timeline can be a simple numbered list. No invented client names, quotes, or measured outcomes.',
    seoHint: 'Include industry-specific keywords. Target "[service] example project" and "how [industry] uses [service]" queries.',
  },

  'myth-buster': {
    id: 'myth-buster',
    name: 'Myth-Busting Article',
    wordRange: [1800, 2500],
    tone: 'confident and slightly provocative — challenge assumptions with evidence',
    openingInstruction:
      'Open with a widely believed myth stated as fact, then immediately flip it: "Everyone says X. They\'re wrong. Here\'s why."',
    structurePrompt: `
1. Hook: state the most common myth as if it's true, then reveal the truth
2. For each myth (5-7 myths), use this pattern:
   - H2: "Myth: [the myth]"
   - H3: "Reality: [the truth]"
   - Reasoning and concrete examples supporting the reality (verified facts where available)
   - Why this myth persists
3. Summary: "What's actually true about [topic]"
4. Call-to-action: "Ready to make decisions based on facts?"`,
    formattingRules:
      'Use H2 for each myth labeled "Myth:" and H3 for each reality labeled "Reality:". Use blockquotes for the myth statement. Bold the reality statement. Debunk with engineering reasoning and worked examples; cite numbers only from the verified facts provided.',
    seoHint: 'Target "[topic] myths", "is it true that", "[topic] misconceptions" keywords.',
  },

  checklist: {
    id: 'checklist',
    name: 'Checklist / Readiness Guide',
    wordRange: [1500, 2000],
    tone: 'practical and actionable — every sentence should help the reader DO something',
    openingInstruction:
      'Open with "Before you [action], make sure you can check off every item on this list." Create urgency around being prepared.',
    structurePrompt: `
1. Why this checklist matters (brief, 2-3 sentences)
2. The Checklist: 10-15 items grouped into 3-4 categories
3. Each item: checkbox-style bullet, one-line description, then 1-2 sentences of why it matters
4. Scoring guide: "If you checked 12+: ready. 8-11: almost there. Below 8: you need help"
5. What to do if you're not ready yet
6. Call-to-action: "Want us to run through this checklist with you? Free assessment"`,
    formattingRules:
      'Use "- [ ]" or "- ✅" style checkbox items. Group items under H2 categories. Keep descriptions short and punchy. Include a scoring section at the end.',
    seoHint: 'Target "[topic] checklist", "readiness assessment", "before you [action]" keywords.',
  },

  'trend-report': {
    id: 'trend-report',
    name: 'Trends & Predictions',
    wordRange: [1800, 2500],
    tone: 'forward-thinking and authoritative — position the company as industry insiders',
    openingInstruction:
      'Open with the single most consequential shift you can support — a verified fact if one is available, otherwise a concrete change you have seen in client work. Never invent a statistic for the hook.',
    structurePrompt: `
1. Market landscape overview (verified facts where available; otherwise qualitative, from experience)
2. Trend 1 through Trend 4-6, each as H2 with:
   - What's happening (cite a verified fact if one supports it)
   - Why it matters for businesses
   - How to prepare or take advantage
3. Predictions for the next 1-2 years (clearly labeled as your expectations)
4. What this means for businesses in Central Asia specifically
5. Action items: what to do right now
6. Call-to-action: "Stay ahead of these trends — let's build your strategy"`,
    formattingRules:
      'Numbers and source links may come ONLY from the verified facts provided. Use bold for numbers. Use blockquotes for key predictions. Include a timeline or summary table.',
    seoHint: 'Target "[topic] trends [year]", "future of [topic]", "[topic] predictions" keywords.',
  },

  'roi-analysis': {
    id: 'roi-analysis',
    name: 'ROI / Business Case Analysis',
    wordRange: [2000, 3000],
    tone: 'data-driven and persuasive — speak the language of business owners and decision-makers',
    openingInstruction: 'Open with the skeptic\'s question: "Is [investment] really worth it? Let\'s look at the actual numbers."',
    structurePrompt: `
1. The investment question — frame the cost as an investment decision
2. The costs: honest breakdown of what you'll spend
3. The returns: benefits, with verified facts where available and qualitative reasoning where not
4. ROI calculation: simple formula walked through on a clearly-hypothetical example business
5. Payback timeline: when you'll see returns
6. Risk factors and how to mitigate them
7. Worked example: a typical (hypothetical) business making this investment
8. The cost of doing nothing (opportunity cost)
9. Call-to-action: "Calculate your specific ROI — talk to us"`,
    formattingRules:
      'Use tables for cost/benefit breakdowns. Bold all dollar amounts and percentages. Use a blockquote for the key ROI figure. Include a simple calculation the reader can follow. All hypothetical numbers must be framed as estimates ("a typical retailer might..."), never as real client results.',
    seoHint: 'Target "ROI of [topic]", "is [topic] worth it", "[topic] cost vs benefit" keywords.',
  },

  'beginner-guide': {
    id: 'beginner-guide',
    name: 'Beginner-Friendly Explainer',
    wordRange: [2000, 3000],
    tone: 'friendly, patient, and jargon-free — explain like talking to a smart non-technical person',
    openingInstruction:
      "Start with empathy: \"If you've heard about [topic] but aren't sure what it means for your business, you're in the right place.\"",
    structurePrompt: `
1. What is [topic]? (plain language, no jargon, use an analogy)
2. Why should you care? (business impact in simple terms)
3. How does it work? (simplified explanation, maybe a real-world analogy)
4. Common use cases (3-5 examples relevant to the reader's business)
5. Glossary of key terms (brief definitions)
6. Common misconceptions
7. How to get started (simple next steps)
8. Call-to-action: "Want to explore if [topic] is right for your business?"`,
    formattingRules:
      'Use analogies and real-world examples. Define technical terms in bold on first use. Keep paragraphs short. Use H2 as questions where possible. Include a glossary section.',
    seoHint: 'Target "what is [topic]", "[topic] explained", "[topic] for beginners", "[topic] guide" keywords.',
  },

  'deep-dive': {
    id: 'deep-dive',
    name: 'Technical Deep Dive',
    wordRange: [2200, 3000],
    tone: 'expert and technical — for CTOs, tech leads, and developers evaluating solutions',
    openingInstruction:
      'Open with a technical challenge: "When building [system], the architecture decisions you make in week one determine your scaling costs for years."',
    structurePrompt: `
1. Technical context and problem statement
2. Architecture overview (describe system design, data flow)
3. Technology choices and trade-offs (with comparison tables)
4. Implementation patterns and best practices
5. Performance considerations and optimization strategies
6. Security and scalability concerns
7. Common anti-patterns to avoid
8. Code examples or configuration snippets where relevant
9. Monitoring, testing, and maintenance approach
10. Call-to-action: "Need expert architecture guidance?"`,
    formattingRules:
      'Use code blocks for technical examples. Include architecture descriptions in text (no actual diagrams). Use tables for technology comparisons. Use H3 liberally for sub-topics. Bold key technical terms.',
    seoHint: 'Target "[topic] architecture", "[topic] best practices", "how to build [topic]" technical keywords.',
  },

  glossary: {
    id: 'glossary',
    name: 'Glossary / Term Reference',
    wordRange: [1500, 2500],
    tone: 'reference-style, clear, and authoritative — like an industry encyclopedia written for business people',
    openingInstruction:
      'Start with: "The world of [topic] comes with its own vocabulary. Here\'s your no-nonsense reference guide to the terms that matter."',
    structurePrompt: `
1. Brief intro explaining why understanding these terms matters for business decisions
2. 10–15 key terms, each as an H2:
   - Term name in bold
   - Plain-language definition (1-2 sentences)
   - Why it matters for your business (1-2 sentences)
   - Real-world example or analogy
3. Quick-reference summary table (Term | One-line definition)
4. Call-to-action: "Need help navigating [topic]? We speak your language"`,
    formattingRules:
      'Each H2 is a term. Bold the term in the definition. Include a summary table at the end. Keep definitions jargon-free. Use analogies where possible.',
    seoHint: 'Target "[topic] glossary", "[topic] terms explained", "what is [term]" keywords. Structure for rich snippets.',
  },

  'troubleshooting-guide': {
    id: 'troubleshooting-guide',
    name: 'Troubleshooting Guide',
    wordRange: [2000, 3000],
    tone: 'diagnostic and solution-focused — like a senior engineer walking you through fixes',
    openingInstruction: 'Start with: "Something\'s not working right. Let\'s diagnose the problem and fix it — step by step."',
    structurePrompt: `
1. Brief intro: common scenarios where things go wrong
2. 6–10 problems, each as an H2:
   - H3 "Symptom": what you're seeing
   - H3 "Cause": why it happens
   - H3 "Fix": step-by-step resolution
   - H3 "Prevention": how to avoid it next time
3. Quick-reference table (Problem | Most likely cause | Quick fix)
4. When to call in experts
5. Call-to-action: "Stuck on a problem we didn't cover? Let's troubleshoot together"`,
    formattingRules:
      'Each problem is an H2. Use H3 for Symptom/Cause/Fix/Prevention. Include a diagnostic table at the end. Bold key symptoms and fixes. Use numbered steps in Fix sections.',
    seoHint: 'Target "[topic] troubleshooting", "[topic] common problems", "how to fix [topic]" keywords.',
  },
};

export function getBlueprintForFormat(format: PostFormat): PostBlueprint {
  return POST_BLUEPRINTS[format];
}
