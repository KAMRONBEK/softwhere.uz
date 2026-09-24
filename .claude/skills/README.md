# Project skills

Claude Code loads every skill in this folder automatically, locally and in Claude Code on the web, because the folder is committed with the repo.

| Skill                | What it's for                                                                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend-design`    | Anthropic's official front-end design skill (Apache-2.0, copied unchanged from [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design)). Used for any UI or page design work on the site. |
| `client-screening`   | Checks a new lead against the "work we take and don't take" policy and basic fit, then drafts the reply.                                                                                                                     |
| `softwhere-proposal` | Drafts proposals, quotes and SOWs with SoftWhere's offers, prices and terms.                                                                                                                                                 |
| `case-study-writer`  | Turns a project into an honest case study or portfolio entry.                                                                                                                                                                |
| `softwhere-social`   | LinkedIn and X posts, short-video scripts and content calendars. Add real posts to `softwhere-social/references/voice-samples.md` so it matches your voice.                                                                  |
| `social-video`       | Renders social videos (MP4) with free tools: a beat-synced 30-second hype reel with original synthesised music and effects, a calmer explainer, and optional AI voice-over.                                                  |

## Using the business skills outside this repo

`client-screening`, `softwhere-proposal`, `case-study-writer` and `softwhere-social` are business skills, not code skills. To use them in the Claude app too, upload each skill folder as a zip on claude.ai (Settings → Capabilities → Skills). `social-video` needs a browser and ffmpeg, so it works best in Claude Code. Keep the copies here and on claude.ai in sync when prices or policy change.

## Keeping them current

Prices, offers and the client policy come from the Global Playbook (24 September 2026). When the founders change a price or a policy line, update the matching `SKILL.md` in the same commit.
