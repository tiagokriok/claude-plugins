# claude-plugins

Claude Code mods (hooks-module plugins).

| Plugin | What it does |
| --- | --- |
| `quote` | Select text in the transcript, press **Quote Cn** in the band above the prompt (or run `/quote`). A token `[C1 "excerpt…"] → ` lands at the cursor; whatever you type after `→` on that line is your comment. On send, each token becomes a `<quote id="C1">…</quote>` block (plus `<note for="C1">…</note>` when commented) in place, so you can say "do C1, skip C2". Needs fullscreen mode. |
| `pr-panel` | `/pr-panel` opens a side pane for the current branch's PR (GitHub, via `gh`) or MR (GitLab, via `glab`), detected from the `origin` remote. Shows a state badge and a colored merge verdict (green only when nothing blocks). Tabs: summary, comments, pipeline, code, activity. Actions: copy link, refresh, auto-merge while the pipeline runs, merge once it is done (squash on GitHub). Merges are pinned to the head commit you saw (`--match-head-commit` / `--sha`) and the PR is re-fetched before acting. |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install quote --marketplace tiagokriok/claude-plugins
/plugin install pr-panel --marketplace tiagokriok/claude-plugins
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install quote --marketplace tiagokriok/claude-plugins
claude plugin install pr-panel --marketplace tiagokriok/claude-plugins
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `tiagokriok/claude-plugins`, then Add plugin.

`pr-panel` needs `gh` and/or `glab` installed and signed in.

## License

MIT
