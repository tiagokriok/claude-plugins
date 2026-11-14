# claude-plugins

Claude Code mods (hooks-module plugins).

| Plugin | What it does |
| --- | --- |
| `quote` | Select text in the transcript, press **Citar** in the band above the prompt (or run `/quote`), optionally add a comment per quote. Quotes are prepended to your next prompt as `> …` blocks. Needs fullscreen mode. |
| `pr-panel` | `/pr-panel` opens a side pane for the current branch's PR (GitHub, via `gh`) or MR (GitLab, via `glab`), detected from the `origin` remote. Tabs: summary, comments, pipeline, code, activity. Actions: copy link, refresh, auto-merge, merge (squash on GitHub). |

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
