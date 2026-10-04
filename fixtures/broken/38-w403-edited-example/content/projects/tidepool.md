---
example: true   # ← delete this line to publish this entry (it stays hidden while this line is here)
title: "Harbor gauge"
kicker: "CLI · Rust"
group: "Developer tools"
start: 2025-03
end: present
summary: "A tide gauge that costs less than a bicycle."
facts:
  - { label: "Problem", text: "Crash bugs hide between fsync calls." }
  - { label: "Result", lines: ["12/12 seeded bugs found", "0 false positives"] }
  - { label: "Install", code: "cargo install tidepool" }
links:
  - { label: "GitHub", url: "https://github.com/hangfolio" }
home:
  order: 1
  exhibit:
    terminal:
      label: "Sample Tidepool output"
      lines: ["$ tidepool check ./db", "# 3 crash points replayed", "[CRITICAL] lost write after fsync reorder"]
---
Optional longer write-up. With a body, the project gets its own page at /projects/tidepool/.
