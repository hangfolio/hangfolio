# Decisions

Each spike from the build plan answers one question about a platform behaviour before the code depends on it. Its result is recorded here as one note per spike, so later work can cite the decision instead of re-running the experiment.

## Format

One file per spike, named `S<n>.md` (`S1.md` to `S12.md`), with a short header and one paragraph:

```markdown
# S<n>: <the question, in a few words>

- Date: YYYY-MM-DD
- Result: pass | fail | partial
- Decision: <what the code will do; the planned approach, or the fallback that replaces it>

<One paragraph: what was tried, what happened, and the evidence (commands and their output,
versions of the tools involved, file paths, and run URLs when a GitHub run is involved).
If the result is fail or partial, say which fallback was chosen and why.>
```

Rules:

- Write the result even when the spike fails: the fallback is the decision.
- Quote evidence in the note itself. Spike repositories are archived after use and may disappear, so a link alone is not enough.
- Notes are public. Use only fictional names and example content in them.
- If a later finding changes a decision, edit the note and add a dated line saying what changed.
