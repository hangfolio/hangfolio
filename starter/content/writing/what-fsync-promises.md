---
example: true   # ← delete this line to publish this post (it stays hidden while this line is here)
title: "What fsync actually promises"                   # example
date: 2026-09-14                                        # example: the day you publish it
description: "Durability guarantees, in one page."      # example: one line for search results and the feed
tags: [storage]                                         # example
---
When `write` returns, your bytes are in the page cache, not on the disk. A power cut a moment later
can take them away. `fsync` is the call that closes that gap: when it returns without an error, the
file's data and the metadata needed to read it back are on stable storage.

It promises less than people expect. Creating or renaming a file changes the *directory*, so the
directory needs its own `fsync` before the new name survives a crash. And when `fsync` reports an
error, the pages it failed to write may already be marked clean, so calling it again can succeed
without saving anything.

## A short checklist {#checklist}

1. `fsync` the file after writing it.
2. After creating or renaming a file, `fsync` its directory too.
3. Treat an `fsync` error as lost data: don't retry and carry on.

This post is an example. Write yours in Markdown: headings, lists, `code`, and links like
[the Tidepool project](/projects/tidepool/), which work wherever your site is published. The
`{#checklist}` after the heading above pins its anchor, so links to it keep working if you reword it.
