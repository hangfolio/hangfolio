---
# yaml-language-server: $schema=../../../../packages/theme/schema/project.json
title: "Shoal"
kicker: "Build tracer · Rust"
group: "Developer tools"
start: 2025-02
end: present
summary: "Traces every cache miss in a build back to the input that caused it, so a slow build explains itself."
result: { parts: ["up to 62% shorter p95 builds", "0.4% tracing overhead"], muted: "40-node farm · 3 repositories" }
facts:
  - { label: "Problem", text: "Remote caches miss for reasons nobody can see, such as a **timestamp** in a header." }
  - { label: "Result", lines: ["62% shorter p95 builds", "0.4% overhead"] }
  - { label: "Install", code: "cargo install shoal" }
  - label: "Source"
    note: "From source while the crate is in review."
    terminal: { label: "Install Shoal from source", lines: ["$ git clone https://github.com/hangfolio/hangfolio", "$ cargo build --release"] }
links:
  - { label: "Code", url: "https://github.com/hangfolio/hangfolio" }
  - { label: "Write-up", profile: "notes" }
  - { code: "cargo install shoal" }
home:
  order: 1
  exhibit:
    terminal:
      label: "Sample Shoal output"
      lines:
        - "$ shoal explain //app:server"
        - "# 4 misses traced"
        - "[CRITICAL] toolchain hash changed: rustc 1.86 → 1.87"
        - "[HIGH] CI_RUN_ID leaks into the cache key"
        - "[MEDIUM] timestamp in a generated header"
        - "[LOW] unused input: docs/notes.md"
        - ""
        - "done in 0.8s"
---
Shoal records which inputs each build action read, then compares two runs of the same action.
