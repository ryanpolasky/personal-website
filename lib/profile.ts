interface Role {
  company: string;
  title: string;
  type: string;
  location: string;
  when: string;
  body: string;
  metric: { value: string; label: string };
}

export const ROLES: Role[] = [
  {
    company: "Apple",
    title: "Software Engineer",
    type: "full-time",
    location: "cupertino",
    when: "jun 2026 → present",
    body: "joined apple full-time as a software engineer on the camera & edits team, after two summers interning with the org during school.",
    metric: { value: "now", label: "camera + edits" },
  },
  {
    company: "Apple",
    title: "At-Home Advisor",
    type: "customer engineering",
    location: "remote",
    when: "may 2023 → jun 2026",
    body: "worked remotely alongside school, sustaining a 6.87% escalation rate well below department average through independent research and advanced troubleshooting. 0.27 min average call wrap time, 15% above department-average csat, and 2× applecare excellence award recipient (2024, 2025).",
    metric: { value: "+15%", label: "csat vs dept avg" },
  },
  {
    company: "ACM UTD",
    title: "Development Lead · Education Mentor",
    type: "student leadership",
    location: "dallas",
    when: "may 2025 → may 2026",
    body: "served as development lead within acm at ut dallas. mentored 1,200+ hackutd participants and debugged critical issues for 60+ teams. led meteormate, a react, fastapi, and postgres roommate-matching platform. also mentored four underclassmen through internship preparation.",
    metric: { value: "1,200+", label: "hackers mentored" },
  },
  {
    company: "Apple",
    title: "Camera API Test Automation",
    type: "intern",
    location: "cupertino",
    when: "may–aug 2025",
    body: "built automated parsing for thousands of on-device camera and edits tests, integrated llms into the failure-triage pipeline, and shipped a unified bug-report generator that attached relevant failure artifacts.",
    metric: { value: "4,800%", label: "manual triage reduction" },
  },
  {
    company: "Apple",
    title: "WTE Tools Engineer",
    type: "intern",
    location: "cupertino",
    when: "jun–nov 2024",
    body: "built an llm-powered chat interface and python package for translating natural language into sql and nosql queries. migrated internal services from java 11 to jdk 21, addressed security vulnerabilities, designed aws/gcp ci/cd pipelines, and optimized an ios log analyzer for real-time rendering.",
    metric: { value: "nl → sql", label: "schema-aware planner" },
  },
  {
    company: "Altru Health System",
    title: "IT Intern",
    type: "intern",
    location: "grand forks",
    when: "jun 2021 → jul 2022",
    body: "repaired, imaged, and deployed hundreds of machines for a critical healthcare-system expansion. handled urgent hardware deliveries during peak demand and set the department intake record at 300+ devices.",
    metric: { value: "300+", label: "intake record" },
  },
];
