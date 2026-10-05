---
# yaml-language-server: $schema=../../../../packages/theme/schema/project.json
title: "Lanternfish"
kicker: "CLI · language server · VS Code"
group: "Developer tools"
start: 2026-08
end: present
summary: "Checks Kubernetes manifests, Terraform plans and CI workflows as you type, and explains each failing rule with the line that caused it and a fix you can apply from the editor in one step."
result: { parts: ["27/27 seeded misconfigs", "9 ms a check", "412 tests"] }
links:
  - { label: "Case study", url: "https://example.org/lanternfish" }
  - { label: "How it works", url: "https://example.org/lanternfish#design" }
  - { label: "GitHub", url: "https://example.org/kmorrow/lanternfish" }
  - { label: "npm", url: "https://example.org/npm/lanternfish" }
home:
  order: 1
  exhibit:
    terminal:
      label: "Sample terminal output"
      lines:
        - "$ npm install -g lanternfish"
        - "# sample output"
        - "[CRITICAL] api-gw  port 8443 gone"
---
