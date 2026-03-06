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
    title: 'Governance that keeps operations measurable.',
    summary: 'The system rotates its own enterprise showcase every 24 hours so teams see fresh guidance even before an admin customizes the portal.',
    quote: 'A stable system is one where governance is designed before growth demands it.',
    author: 'ZAYA Operations Playbook',
    facts: [
      'Audit-ready workflows reduce disputes because the process is visible before a problem appears.',
      'Strong approval chains protect both compliance and delivery speed when responsibilities are clear.',
      'A shared operational dashboard prevents departments from solving the same problem twice.',
    ],
    image: pexelsImage('https://images.pexels.com/photos/8938358/pexels-photo-8938358.jpeg?fm=jpg'),
  },
  {
    title: 'Development improves when standards arrive first.',
    summary: 'Teams move faster when release rules, rollback plans, and code ownership are part of the workflow rather than an afterthought.',
    quote: 'Good development is not speed alone; it is speed that survives production.',
    author: 'ZAYA Development Desk',
    facts: [
      'Release checklists lower deployment risk by turning tribal knowledge into repeatable action.',
      'Smaller changes are easier to verify, easier to explain, and easier to reverse safely.',
      'Systems with clear ownership recover faster because the right team acts first.',
    ],
    image: pexelsImage('https://images.pexels.com/photos/10347163/pexels-photo-10347163.jpeg?fm=jpg'),
  },
  {
    title: 'Strategy is visible when teams work from one source of truth.',
    summary: 'Aligned teams execute better when planning, review, and decisions happen around the same operational picture.',
    quote: 'Clear strategy becomes practical only when the team can see the same facts at the same time.',
    author: 'ZAYA Leadership Desk',
    facts: [
      'Shared visibility reduces handoff errors between operations, recruitment, and leadership teams.',
      'Good strategy meetings end with owners, timelines, and measurable next steps.',
      'Teams trust systems more when the workflow reflects actual business priorities.',
    ],
    image: pexelsImage('https://images.pexels.com/photos/31709062/pexels-photo-31709062.jpeg?fm=jpg'),
  },
  {
    title: 'Resilience is built before recovery is needed.',
    summary: 'A resilient system keeps local capability, shared data sync, and operational continuity ready before network or service issues appear.',
    quote: 'Recovery works when continuity is designed into normal operations, not added during failure.',
    author: 'ZAYA Recovery Protocol',
    facts: [
      'Fallback capability matters because real operations cannot pause while waiting for perfect connectivity.',
      'Regular backups are useful only when restore steps are also tested and understood.',
      'Visibility into sessions, machines, and changes reduces downtime during incident response.',
    ],
    image: pexelsImage('https://images.pexels.com/photos/7984727/pexels-photo-7984727.jpeg?fm=jpg'),
  },
];
