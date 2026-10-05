---
# yaml-language-server: $schema=../../../../packages/theme/schema/project.json
title: "Tern: batched fsync for log stores"
kicker: "Research · C++"
group: "Research"
margin: "In prep."
summary: "Groups fsync calls across tenants without breaking any tenant's durability promise."
listed: false
home:
  order: 2
  title: "Batched fsync"
  result: "up to 3.1× write throughput"
  footnote: ["In preparation for a 2027 venue", "No public link yet"]
  exhibit:
    metrics:
      title: "ablation"
      rows:
        - { label: "throughput (Kops/s)", before: "41", after: "127", highlight: true }
        - { label: "p99 latency (ms)", before: "8.2", after: "6.9", highlight: true }
        - { label: "fsyncs per op", before: "1.00", after: "0.12" }
      footer: "0 durability violations"
      footerMuted: "(2,000 crash trials)"
---
