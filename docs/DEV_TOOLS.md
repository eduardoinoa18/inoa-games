# Claude Code plugins for this repo (2026-10-18)

Enabled in `.claude/settings.json`, so every Claude Code session opened in this repo offers them. The first time, Claude Code asks you to trust each marketplace.

| Plugin | What it does | Toggle |
| --- | --- | --- |
| **Ponytail** (`DietrichGebert/ponytail`, MIT) | One prompt-based skill that makes Claude choose the simplest adequate solution and write less code; adds `/ponytail-review` and `/ponytail-audit`. Maintainer's benchmark: 53% fewer lines, 45% fewer output tokens, 26% lower cost, and more risky logic shipped with tests (self-reported; 39 tasks × 5 runs) | `/ponytail lite\|full\|ultra\|off`. Use `lite` for games, where feel code (juice, effects) is "extra" by design |
| **Agent Skills** (`addyosmani/agent-skills`, MIT) | 25 engineering-process skills (24 + a router) and `/spec /plan /build /test /constraints /review /webperf /code-simplify /ship` | Invoke the commands when you want the structure |

Install by hand instead (personal, not repo-wide):
```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
/plugin marketplace add addyosmani/agent-skills
/plugin install agent-skills@addy-agent-skills
```

## OmniRoute: not configured in this repo, on purpose
OmniRoute (`diegosouzapw/OmniRoute`, MIT) is a local gateway (`http://localhost:20128/v1`) that routes Claude Code's requests, and with them this code, to other providers, many on free tiers, with key/account pooling. It cannot be committed here safely: it needs your own provider accounts and keys, and pointing this repo's sessions at it would break everyone else's. If you want it on **your own computer**:
1. Install the npm package `omniroute` (or the Docker image `diegosouzapw/omniroute`), following its README Quick Start.
2. Add only providers you have a paid or official account with. Leave the `tos: avoid` providers excluded; that is the default.
3. Launch Claude Code through it per process: `omniroute run claude --model <provider/model>`. Prefer `auto/subscription`, which uses only quota you already pay for and fails closed.

Risks: your source code goes to whichever provider answers. Free tiers may train on inputs. Pooling or sharing accounts can break provider terms and get accounts banned. Other models write noticeably different code than Claude, and the quality of this repo depends on that. Never put provider keys in this repo.
