# invoices

Fakturačná appka pre slovenského neplatiteľa DPH (náhrada iDokladu). Znalosti agenta sú v `docs/agents/invoices.md`, stav poslednej session v `docs/handoff/agent-invoices.md`.

`docs/` je v gite ignorovaný a nesmie sa commitovať (repo je verejné). Do cloudu ho dostaneš cez Tabulu, nie cez git.

## Memory (Tabula)
Tabula keeps this project's files that are not in git (handoff state, private specs and plans) and the global rules that apply to every project.
- This project's Tabula project is `invoices`; `.tabula.json` says which untracked files are synced.
- At session start call `recall` for `invoices` with `include_state: false` and follow the global rules. The project state is on disk (restored by the SessionStart hook).
- At handoff run `tabula push` after writing the state file.
- Never write project memories. Add a global rule only when the user explicitly asks.
