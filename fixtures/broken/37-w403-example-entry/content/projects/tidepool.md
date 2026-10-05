---
example: true   # ← delete this line to publish this entry (it stays hidden while this line is here)
title: "Tidepool"                 # example
kicker: "CLI · Rust"              # example: a short line above the title
group: "Developer tools"          # example: the heading it is listed under on /projects
start: 2025-03                    # example
end: present                      # example: or a date like 2025-12
summary: "Replays crash points to find lost writes in key-value stores."   # example
facts:                            # example: Problem, Built, Result, Install… any labels you like
  - { label: "Problem", text: "Crash bugs hide between fsync calls." }
  - { label: "Result", lines: ["12/12 seeded bugs found", "0 false positives"] }
  - { label: "Install", code: "cargo install tidepool" }
links:                            # example
  - { label: "GitHub", url: "https://github.com/hangfolio" }
home:                             # example: this block puts the project in "Selected work" on the home page
  order: 1
  exhibit:
    terminal:
      label: "Sample Tidepool output"
      lines: ["$ tidepool check ./db", "# 3 crash points replayed", "[CRITICAL] lost write after fsync reorder"]
---
Everything below the second `---` line is optional. When a project has text here, it gets its own
page at /projects/tidepool/.

Tidepool runs a key-value store under a recorder, cuts the recording at every point where a crash
could happen, and replays each cut against a fresh copy of the store. After each replay it checks
that every write the store acknowledged is still there.

## How it works

1. Record the system calls of a short workload.
2. List the crash points between `write` and `fsync` calls.
3. Replay each prefix, restart the store, and compare its contents with what it acknowledged.
