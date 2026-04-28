import { CAMPAIGN_ID } from './constants.js';
import { verifyStructure } from '../lib/verification.js';

// 24 Copilot-Chat-only tasks. Each entry preserves the exact prompt and
// verification rule set from the legacy implementation so deterministic
// boards remain functionally equivalent.
export const TASK_BANK = [
  {
    title: 'Email Summariser',
    tag: 'Productivity',
    prompt: `You are a professional email summariser. Please respond to this prompt with the following structure — include the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE at the very start of your reply, then produce EXACTLY 3 bullet points summarising an imaginary unread work email about a Q3 budget review, followed by a one-sentence recommended action. Format:\nVERIFY-MARKER\n• Summary point 1\n• Summary point 2\n• Summary point 3\nAction: [your recommended action]`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, { marker: true, bullets: 3, action: true }),
  },
  {
    title: 'Meeting Agenda Maker',
    tag: 'Productivity',
    prompt: `You are a meeting planner. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then generate a meeting agenda for a 30-minute team stand-up with EXACTLY 4 numbered items (1. 2. 3. 4.), each item having a short description. Format:\nVERIFY-MARKER\n1. Item: description\n2. Item: description\n3. Item: description\n4. Item: description`,
    verify: (proof, pid, ti) => verifyStructure(proof, pid, ti, { marker: true, numberedItems: 4 }),
  },
  {
    title: 'SWOT Analyser',
    tag: 'Strategy',
    prompt: `You are a business analyst. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then produce a SWOT analysis of a fictional coffee shop using EXACTLY 4 headings: ## Strengths, ## Weaknesses, ## Opportunities, ## Threats — each heading followed by at least 2 bullet points.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, {
        marker: true,
        headings: ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'],
      }),
  },
  {
    title: 'Study Plan Generator',
    tag: 'Learning',
    prompt: `You are a study coach. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then create a 5-day study plan for learning Python basics. Present it as a table with EXACTLY 3 columns: Day | Topic | Activity. Include EXACTLY 5 data rows.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, { marker: true, tableRows: 5, tableCols: 3 }),
  },
  {
    title: 'Cover Letter Draft',
    tag: 'Career',
    prompt: `You are a career coach. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then write a short cover letter for a Data Analyst internship. It must have EXACTLY 3 paragraphs (each separated by a blank line) and end with "Yours sincerely,".\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, {
        marker: true,
        paragraphs: 3,
        endsWith: 'Yours sincerely,',
      }),
  },
  {
    title: 'Pro-Con Table',
    tag: 'Decision Making',
    prompt: `You are a decision analyst. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then create a pros-and-cons table for remote work. Use a markdown table with EXACTLY 2 columns: Pro | Con, and EXACTLY 5 data rows.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, { marker: true, tableRows: 5, tableCols: 2 }),
  },
  {
    title: 'Concept Explainer',
    tag: 'Learning',
    prompt: `You are a teacher. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then explain "machine learning" in plain English using EXACTLY 3 short paragraphs (each separated by a blank line). Each paragraph must start with a bold key term like **Term**.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, {
        marker: true,
        paragraphs: 3,
        boldTerms: true,
      }),
  },
  {
    title: 'FAQ Creator',
    tag: 'Communication',
    prompt: `You are a content writer. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then write an FAQ section for a fictional university app with EXACTLY 5 Q&A pairs. Format each as:\nQ: [question]\nA: [answer]\nVERIFY-MARKER`,
    verify: (proof, pid, ti) => verifyStructure(proof, pid, ti, { marker: true, qaCount: 5 }),
  },
  {
    title: 'Action Plan Writer',
    tag: 'Productivity',
    prompt: `You are a project manager. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then write a 5-step action plan to improve team communication. Number steps 1. to 5. Each step must have a sub-bullet starting with → explaining HOW.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, {
        marker: true,
        numberedItems: 5,
        subBullets: true,
      }),
  },
  {
    title: 'Feedback Rewriter',
    tag: 'Communication',
    prompt: `You are an executive coach. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then rewrite this blunt feedback in a constructive tone — "Your report was late and full of errors" — as EXACTLY 3 bullet points, each starting with "•".\nVERIFY-MARKER`,
    verify: (proof, pid, ti) => verifyStructure(proof, pid, ti, { marker: true, bullets: 3 }),
  },
  {
    title: 'Data Insight Narrator',
    tag: 'Analytics',
    prompt: `You are a data storyteller. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then narrate 3 fictional data insights from a student survey using EXACTLY 3 headings: ## Insight 1, ## Insight 2, ## Insight 3 — each with one sentence of analysis.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, {
        marker: true,
        headings: ['Insight 1', 'Insight 2', 'Insight 3'],
      }),
  },
  {
    title: 'Social Post Drafter',
    tag: 'Marketing',
    prompt: `You are a social media manager. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then draft a LinkedIn post announcing a new AI workshop. The post must include: EXACTLY 3 bullet points with benefits (each starting with •), 1 call-to-action sentence, and end with EXACTLY 3 relevant hashtags on the last line.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, { marker: true, bullets: 3, hashtags: 3 }),
  },
  {
    title: 'JSON Profile Builder',
    tag: 'Technical',
    prompt: `You are a developer. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then produce a JSON object for a fictional student profile. It must include EXACTLY these keys: "name", "university", "course", "year", "skills" (an array of EXACTLY 3 strings). Format as valid JSON inside a code block.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, {
        marker: true,
        jsonKeys: ['name', 'university', 'course', 'year', 'skills'],
      }),
  },
  {
    title: 'Risk Register Row',
    tag: 'Project Mgmt',
    prompt: `You are a risk manager. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then fill in a risk register row as a markdown table with EXACTLY 5 columns: Risk | Likelihood | Impact | Mitigation | Owner. Provide EXACTLY 3 data rows.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, { marker: true, tableRows: 3, tableCols: 5 }),
  },
  {
    title: 'OKR Drafter',
    tag: 'Strategy',
    prompt: `You are a strategy consultant. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then draft one OKR for a student club's semester. Format as:\nObjective: [one sentence]\nKey Results:\n1. [KR1]\n2. [KR2]\n3. [KR3]\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, {
        marker: true,
        numberedItems: 3,
        hasObjective: true,
      }),
  },
  {
    title: 'Icebreaker Generator',
    tag: 'Team Building',
    prompt: `You are a facilitator. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then generate EXACTLY 5 icebreaker questions for a new student orientation. Number them 1. to 5. Each question must end with a "?".\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, {
        marker: true,
        numberedItems: 5,
        endWithQ: true,
      }),
  },
  {
    title: 'Press Release Opener',
    tag: 'Communication',
    prompt: `You are a PR specialist. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then write the opening paragraph of a press release for a fictional AI conference. It must start with a city/date dateline like "SINGAPORE, [Month] [Year] —" and be followed by EXACTLY 2 more paragraphs.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, {
        marker: true,
        paragraphs: 3,
        dateline: true,
      }),
  },
  {
    title: 'Lesson Plan Outline',
    tag: 'Education',
    prompt: `You are a curriculum designer. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then outline a 60-minute lesson on "Responsible AI". Use EXACTLY 3 sections with headings: ## Introduction (15 min), ## Main Activity (35 min), ## Wrap-Up (10 min), each with 2 bullet points.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, {
        marker: true,
        headings: ['Introduction', 'Main Activity', 'Wrap-Up'],
      }),
  },
  {
    title: 'Elevator Pitch',
    tag: 'Career',
    prompt: `You are a pitch coach. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then write a 30-second elevator pitch for a student presenting their final-year project on AI ethics. The pitch must be EXACTLY 3 sentences. Each sentence must start with a capital letter and end with a full stop.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) => verifyStructure(proof, pid, ti, { marker: true, sentences: 3 }),
  },
  {
    title: 'Stakeholder Email',
    tag: 'Communication',
    prompt: `You are a business communicator. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then draft a brief stakeholder update email about a delayed project milestone. The email must have: Subject: line, a greeting, EXACTLY 2 bullet points on impact, a next-steps sentence, and a sign-off.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, {
        marker: true,
        bullets: 2,
        hasSubject: true,
      }),
  },
  {
    title: 'Competitive Analysis',
    tag: 'Strategy',
    prompt: `You are a market analyst. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then compare two fictional AI tools (Tool A vs Tool B) using a markdown table with EXACTLY 4 columns: Feature | Tool A | Tool B | Winner, and EXACTLY 5 data rows.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, { marker: true, tableRows: 5, tableCols: 4 }),
  },
  {
    title: 'Workshop Agenda',
    tag: 'Events',
    prompt: `You are an event planner. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then create a half-day workshop agenda for a "Digital Skills Bootcamp". Use a table with EXACTLY 3 columns: Time | Session | Facilitator, and EXACTLY 6 data rows.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, { marker: true, tableRows: 6, tableCols: 3 }),
  },
  {
    title: 'Brainstorm List',
    tag: 'Creativity',
    prompt: `You are a creative consultant. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then brainstorm EXACTLY 8 ideas for a student hackathon theme related to sustainability. Number them 1. to 8.\nVERIFY-MARKER`,
    verify: (proof, pid, ti) => verifyStructure(proof, pid, ti, { marker: true, numberedItems: 8 }),
  },
  {
    title: 'Reflection Prompt',
    tag: 'Learning',
    prompt: `You are a learning coach. Respond with the marker VERIFY-${CAMPAIGN_ID}-PACK-TILE on line 1, then write a structured reflection on using AI tools in studies using EXACTLY 3 headings: ## What Went Well, ## What I Learned, ## What I'll Do Differently — each with EXACTLY 2 bullet points starting with "-".\nVERIFY-MARKER`,
    verify: (proof, pid, ti) =>
      verifyStructure(proof, pid, ti, {
        marker: true,
        headings: ['What Went Well', 'What I Learned', "What I'll Do Differently"],
      }),
  },
];
