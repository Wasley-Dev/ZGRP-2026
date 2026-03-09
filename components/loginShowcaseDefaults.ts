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
      'Audit-ready workflows reduce disputes because the process is visible before a problem appears.',
      'Strong approval chains protect both compliance and delivery speed when responsibilities are clear.',
      'A shared operational dashboard prevents departments from solving the same problem twice.',
    ],
    image: pexelsImage('https://images.pexels.com/photos/8938358/pexels-photo-8938358.jpeg?fm=jpg'),
  },
  {
    title: 'Execution improves when standards arrive first.',
    summary: 'Teams move faster when release rules, rollback plans, and ownership are designed into the operating model rather than added after pressure appears.',
    quote: 'Operational speed matters only when it remains dependable in production.',
    author: 'ZAYA Development Desk',
    facts: [
      'Release checklists lower deployment risk by turning tribal knowledge into repeatable action.',
      'Smaller changes are easier to verify, easier to explain, and easier to reverse safely.',
      'Systems with clear ownership recover faster because the right team acts first.',
    ],
    image: pexelsImage('https://images.pexels.com/photos/10347163/pexels-photo-10347163.jpeg?fm=jpg'),
  },
  {
    title: 'Strategy becomes credible when one system anchors the discussion.',
    summary: 'Leadership decisions move with more confidence when planning, review, and approvals are tied to a single operational picture.',
    quote: 'Executive clarity begins when the same facts are visible to every decision-maker.',
    author: 'ZAYA Leadership Desk',
    facts: [
      'Decision quality improves when reporting, approvals, and action owners stay in one workflow.',
      'Senior teams act faster when timelines and accountability are explicit from the start.',
      'Enterprise systems earn trust when the interface reflects real priorities, not generic software patterns.',
    ],
    image: pexelsImage('https://images.pexels.com/photos/31709062/pexels-photo-31709062.jpeg?fm=jpg'),
  },
  {
    title: 'Resilience is designed before recovery is needed.',
    summary: 'A resilient platform keeps local capability, shared sync, and continuity measures ready before network or service pressure appears.',
    quote: 'Recovery succeeds when continuity is built into normal operations, not improvised during failure.',
    author: 'ZAYA Recovery Protocol',
    facts: [
      'Fallback capability matters because real operations cannot pause while waiting for perfect connectivity.',
      'Regular backups are useful only when restore steps are also tested and understood.',
      'Visibility into sessions, machines, and changes reduces downtime during incident response.',
    ],
    image: pexelsImage('https://images.pexels.com/photos/7984727/pexels-photo-7984727.jpeg?fm=jpg'),
  },
];
