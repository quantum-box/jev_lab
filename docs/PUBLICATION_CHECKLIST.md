# Publication checklist (initial 8 PoCs)

Use this checklist before sharing a preview or publishing the first eight replay-ready PoCs.

- [ ] Replay test passes for each PoC; no live provider is needed for the review.
- [ ] No live API key is present in browser storage, source, logs, or preview configuration.
- [ ] Explicit authentication and budget setup is documented before any live smoke test.
- [ ] Evaluation uses the checked-in fixture dataset and labels; model output is not ground truth.
- [ ] Mobile layout and keyboard navigation have been checked for gallery, detail, evaluation, and Runs.
- [ ] Game and audio experiences do not autoplay; visual and text alternatives are present.
- [ ] No external side effects (payment, deletion, purchase, or production mutation) occur in replay/rule mode.
- [ ] GitHub Actions CI is green. Hosting/shared preview remains intentionally unconfigured until a host is selected.
- [ ] Tiny World remains synthetic-only: no real-person/social prediction, unlimited chat, or automatic Jev calls.
- [ ] Tiny World local-visibility isolation, atomic resource/trade constraints, fixed-seed scenarios, trace replay, and gameplay E2E pass.
