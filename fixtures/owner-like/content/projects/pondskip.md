---
# yaml-language-server: $schema=../../../../packages/theme/schema/project.json
title: "pondskip"
kicker: "CI service · GitHub Actions app"
group: "Developer tools"
start: 2026-06
end: present
summary: "Reruns a failing CI test in a clean container to tell flakiness from a real regression, then quarantines flaky tests with the evidence attached so merges keep moving."
links:
  - { label: "Write-up", url: "https://example.org/pondskip/notes" }
  - { label: "How it works", url: "https://example.org/pondskip/notes#design" }
  - { label: "GitHub", url: "https://example.org/kmorrow/pondskip" }
  - { label: "npm", url: "https://example.org/npm/pondskip" }
  - { code: "npm i -g pondskip" }
home:
  order: 3
  exhibit:
    metrics:
      title: "rollout"
      rows:
        - { label: "merge blocks", before: "0.41", after: "0.06", highlight: true }
        - { label: "failures kept", before: "0.88", after: "1.00", highlight: true }
      footer: "0 regressions hidden"
      footerMuted: "(60 runs)"
---
