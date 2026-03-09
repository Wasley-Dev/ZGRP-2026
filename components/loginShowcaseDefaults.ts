const pexelsImage = (url: string): string => `${url}&auto=compress&cs=tinysrgb&w=3840`;

export interface ShowcasePreset {
  title: string;
  summary: string;
  quote: string;
  author: string;
  facts: string[];
  image: string;
}

export const DEFAULT_LOGIN_SHOWCASES: ShowcasePreset[] = [
  {
    title: 'Governance that keeps leadership informed.',
    summary: 'The portal rotates a refined executive showcase each day so the login experience stays current, disciplined, and aligned with enterprise standards.',
    quote: 'Growth holds when governance is visible before complexity arrives.',
    author: 'ZAYA Operations Playbook',
    facts: [
      'Development grows faster when teams work from one governed process instead of isolated habits.',
      'Productivity improves when approval paths are visible before work begins, not after delays appear.',
      'Growth becomes measurable when one operational dashboard supports every leadership review.',
    ],
    image: pexelsImage('https://images.pexels.com/photos/8938358/pexels-photo-8938358.jpeg?fm=jpg'),
  },
  {
    title: 'Execution improves when standards arrive first.',
    summary: 'Teams move faster when release rules, rollback plans, and ownership are designed into the operating model rather than added after pressure appears.',
    quote: 'Operational speed matters only when it remains dependable in production.',
    author: 'ZAYA Development Desk',
    facts: [
      'Development quality rises when release checklists turn tribal knowledge into repeatable action.',
      'Team productivity improves when smaller changes are easier to verify, explain, and reverse safely.',
      'Business growth is easier to sustain when system ownership is clear before issues escalate.',
    ],
    image: pexelsImage('https://images.pexels.com/photos/10347163/pexels-photo-10347163.jpeg?fm=jpg'),
  },
  {
    title: 'Strategy becomes credible when one system anchors the discussion.',
    summary: 'Leadership decisions move with more confidence when planning, review, and approvals are tied to a single operational picture.',
    quote: 'Executive clarity begins when the same facts are visible to every decision-maker.',
    author: 'ZAYA Leadership Desk',
    facts: [
      'Productivity rises when reporting, approvals, and owners stay inside one accountable workflow.',
      'Growth planning becomes practical when timelines and accountability are explicit from the start.',
      'Strong systems support development by reflecting real priorities instead of generic software habits.',
    ],
    image: pexelsImage('https://images.pexels.com/photos/31709062/pexels-photo-31709062.jpeg?fm=jpg'),
  },
  {
    title: 'Resilience is designed before recovery is needed.',
    summary: 'A resilient platform keeps local capability, shared sync, and continuity measures ready before network or service pressure appears.',
    quote: 'Recovery succeeds when continuity is built into normal operations, not improvised during failure.',
    author: 'ZAYA Recovery Protocol',
    facts: [
      'Operational productivity is protected when fallback capability exists before connectivity fails.',
      'Growth stays resilient when backup and restore steps are tested, not assumed.',
      'Development maturity shows when visibility into sessions, machines, and changes shortens downtime.',
    ],
    image: pexelsImage('https://images.pexels.com/photos/7984727/pexels-photo-7984727.jpeg?fm=jpg'),
  },
];
