---
origin: ai-generated
review_status: reviewed
---

# Log

Append-only operational log. The LLM adds an entry after every ingest or significant operation. The web app's homepage feed reads dated lines (`- YYYY-MM-DD ...`) from this file.

Format:

```markdown
## [YYYY-MM-DD] operation | Title
- Description of what was done
- Files created/updated: list
```

Operations: `ingest`, `query`, `lint`, `review`, `restructure`

---

<!-- Newest entries go here, e.g.:

## [2026-01-15] ingest | Atomic Habits - James Clear
- Extracted 7 atomic ideas, created 3 new concepts
- Files: 20 Ideas/Books/*.md, 30 Concept/{habits,identity,systems}.md
-->

## [2026-08-06] restructure | 打磨硅谷101这期的 8 条 idea 笔记
- 按用户反馈重写全部 Insight：每条先立可迁移的经久道理，节目具体事件降为例证
- Files: 20 Ideas/Podcasts/*.md (8, insight sections only)

## [2026-08-06] ingest | 硅谷101：与月之暗面投资人叶奇意聊Kimi前史与中国AI十年接力
- Ingested Apple Podcasts 单集链接（id 1000779348807，视频版 2026-07-28 发布）；网络策略屏蔽了 RSS/Apple/YouTube，正文为二手文字稿（钛媒体/搜狐/网易转载）整理的内容纪要并已标注；extracted 8 atomic ideas, created 2 new concepts（人才迁徙、投资判断）, bumped 6 existing concepts to source_count 2
- Files: 10 Notes/Podcasts/中国开源模型摸到SOTA了 与月之暗面投资人聊Kimi前史 - 硅谷101.md, 20 Ideas/Podcasts/*.md (8), 30 Concept/{人才迁徙,投资判断}.md, 30 Concept/{AGI,研究文化,算力,克制,愿景,开源}.md (updated)

## [2026-07-23] ingest | 梁文锋投资者交流会 · 录音文字稿
- Ingested user-uploaded PDF（42 页录音文字稿，录音 2026-05-20，约 3 小时 44 分钟）; full transcript preserved as source, extracted 12 atomic ideas, created 8 new concepts; extended Topic Vocabulary with `AI`
- Files: 10 Notes/Conversations/梁文锋投资者交流会 - 梁文锋.md, 20 Ideas/Conversations/*.md (12), 30 Concept/{克制,愿景,开源,合理利润,持续学习,AGI,算力,研究文化}.md
