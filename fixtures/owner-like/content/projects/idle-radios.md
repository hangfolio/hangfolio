---
# yaml-language-server: $schema=../../../../packages/theme/schema/project.json
title: "Energy cost of idle phone radios"
kicker: "Paper + public dataset"
group: "Research"
margin: "NSX ’24"
summary: "We measured the battery idle radios burn on budget Android phones in six countries."
result: { tag: "Data", parts: ["9.4K devices", "31K traces", "6 countries"] }
links:
  - { label: "Paper (PDF)", url: "/files/morrow2024idle.pdf" }
  - { label: "Code & data", url: "https://example.org/kmorrow/idle-radios" }
  - { label: "Explainer", url: "https://example.org/idle-radios" }
  - { label: "How it works", url: "https://example.org/idle-radios#method" }
home:
  order: 4
  exhibit:
    bars:
      label: "Idle radio drain per day"
      rows:
        - { label: "5G", value: 9.8, unit: "Wh", tone: accent }
        - { label: "LTE", value: 3.2, unit: "Wh", tone: faint }
      caption: "**~3×** more idle drain on 5G than on LTE"
---
