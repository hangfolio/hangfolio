---
example: true   # ← delete this line to publish this entry (it stays hidden while this line is here)
title: "Lattice"                  # example
kicker: "Research artifact · Go"  # example
group: "Research artifacts"       # example
start: 2024-01                    # example
end: 2024-05                      # example
summary: "The lease protocol behind [bounded staleness](/publications#vale2024bounded), with the benchmark harness from the paper."   # example
facts:                            # example
  - { label: "Problem", text: "Edge caches serve stale data with no bound on how stale." }
  - { label: "Built", text: "Leases that expire before a replica can fall more than a set bound behind." }
  - { label: "Result", text: "p99 read latency up to 40% lower than strong reads, with staleness capped at 250 ms." }
links:                            # example
  - { label: "Code", url: "https://github.com/hangfolio" }
  - { label: "Paper", url: "/publications#vale2024bounded" }
home:                             # example: featured second in "Selected work"
  order: 2
  exhibit:
    bars:
      label: "p99 read latency"
      rows:
        - { label: "Strong reads", value: 48, unit: "ms", tone: faint }
        - { label: "Lattice", value: 29, unit: "ms", tone: accent }
      caption: "Lower is better. A synthetic edge workload across 3 regions."
---
