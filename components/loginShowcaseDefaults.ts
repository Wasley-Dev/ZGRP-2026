const svgToDataUrl = (svg: string): string => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const createCorporateScene = (
  title: string,
  accent: string,
  secondary: string,
  panelTone: string,
  icon: string
): string =>
  svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1100" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#031a34"/>
          <stop offset="45%" stop-color="${secondary}"/>
          <stop offset="100%" stop-color="#04101d"/>
        </linearGradient>
        <radialGradient id="glow" cx="25%" cy="15%" r="60%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.75"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1600" height="1100" fill="url(#bg)"/>
      <rect width="1600" height="1100" fill="url(#glow)"/>
      <circle cx="1350" cy="180" r="260" fill="${accent}" fill-opacity="0.14"/>
      <circle cx="1240" cy="860" r="340" fill="#ffffff" fill-opacity="0.05"/>
      <rect x="120" y="130" width="470" height="320" rx="34" fill="${panelTone}" fill-opacity="0.88"/>
      <rect x="168" y="190" width="270" height="26" rx="13" fill="#ffffff" fill-opacity="0.22"/>
      <rect x="168" y="238" width="192" height="18" rx="9" fill="${accent}" fill-opacity="0.92"/>
      <rect x="168" y="290" width="340" height="16" rx="8" fill="#ffffff" fill-opacity="0.18"/>
      <rect x="168" y="324" width="300" height="16" rx="8" fill="#ffffff" fill-opacity="0.14"/>
      <rect x="168" y="358" width="252" height="16" rx="8" fill="#ffffff" fill-opacity="0.12"/>
      <rect x="120" y="520" width="590" height="250" rx="38" fill="#ffffff" fill-opacity="0.09" stroke="#ffffff" stroke-opacity="0.12"/>
      <rect x="170" y="575" width="210" height="132" rx="24" fill="${accent}" fill-opacity="0.82"/>
      <rect x="410" y="575" width="250" height="32" rx="16" fill="#ffffff" fill-opacity="0.18"/>
      <rect x="410" y="630" width="214" height="18" rx="9" fill="#ffffff" fill-opacity="0.14"/>
      <rect x="410" y="665" width="190" height="18" rx="9" fill="#ffffff" fill-opacity="0.14"/>
      <rect x="410" y="700" width="156" height="18" rx="9" fill="#ffffff" fill-opacity="0.14"/>
      <g transform="translate(1040 540)">
        <circle r="248" fill="#ffffff" fill-opacity="0.08"/>
        <circle r="178" fill="#ffffff" fill-opacity="0.06"/>
        <rect x="-118" y="-164" width="236" height="328" rx="42" fill="${panelTone}" fill-opacity="0.82" stroke="#ffffff" stroke-opacity="0.14"/>
        <text x="0" y="-16" text-anchor="middle" font-size="150" fill="${accent}" font-family="Arial, sans-serif">${icon}</text>
        <rect x="-78" y="58" width="156" height="16" rx="8" fill="#ffffff" fill-opacity="0.18"/>
        <rect x="-58" y="92" width="116" height="16" rx="8" fill="#ffffff" fill-opacity="0.14"/>
      </g>
      <text x="126" y="986" fill="#ffffff" fill-opacity="0.82" font-size="44" font-weight="700" font-family="Arial, sans-serif">${title}</text>
    </svg>
  `);

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
    image: createCorporateScene('Governance and Visibility', '#D4AF37', '#0b3f78', '#103f66', 'G'),
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
    image: createCorporateScene('Development Discipline', '#7dd3fc', '#123d63', '#15486d', 'D'),
  },
  {
    title: 'Corporate control works best when communication is structured.',
    summary: 'Reliable communication is not just messaging. It includes timing, approvals, records, and the ability to trace decisions later.',
    quote: 'A message becomes policy only when the system can prove who approved it and when.',
    author: 'ZAYA Corporate Affairs',
    facts: [
      'Centralized communication records protect the business during escalations and audits.',
      'Operational delays often come from unclear handoffs rather than lack of effort.',
      'Documented decisions shorten onboarding because new staff inherit context, not confusion.',
    ],
    image: createCorporateScene('Structured Communication', '#fbbf24', '#0d3458', '#14425f', 'C'),
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
    image: createCorporateScene('Resilience and Continuity', '#34d399', '#0b3551', '#134461', 'R'),
  },
];
