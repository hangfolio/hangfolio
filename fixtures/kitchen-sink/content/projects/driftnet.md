---
# yaml-language-server: $schema=../../../../packages/theme/schema/project.json
title: "Driftnet"
kicker: "Paper + public dataset"
group: "Research"
start: 2023-06
end: 2023-09
summary: "A measurement study of how often remote build caches serve stale artifacts."
result: { tag: "Data", parts: ["2.3M cache lookups", "14 organizations"] }
links:
  - { label: "Paper (PDF)", url: "/files/driftnet.pdf" }
  - { label: "Dataset", url: "https://example.org/driftnet" }
home:
  order: 3
  exhibit:
    bars:
      label: "Stale hits per million lookups"
      rows:
        - { label: "Default", value: 412, tone: accent }
        - { label: "Pinned", value: 139, tone: faint }
        - { label: "Hashed", value: 6, tone: faint }
      caption: "**~3×** fewer stale hits once toolchains are pinned"
---
