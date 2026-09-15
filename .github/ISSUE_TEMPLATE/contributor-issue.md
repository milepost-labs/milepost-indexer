---
name: Contributor issue
about: Scoped work for a contributor
title: ''
labels: ''
assignees: ''
---

## What and why

<!-- The problem, not the solution. What list or field is missing today, and
     what changes for the app or an integrator once it is published. -->

## Context

<!-- The contract events involved (name, fields, and where they are emitted in
     milepost), the handler and output files to touch, and anything that will
     surprise someone new. Most issues here follow docs/adding-an-event.md. -->

## Suggested approach

<!-- Enough direction to prevent a dead end, not a line-by-line specification.
     A contributor should be free to disagree with this and do it better. -->

## Acceptance criteria

- [ ] <!-- Observable outcomes. "programmes/<id>/payees.json lists X after event Y", not "look at payees". -->
- [ ] Tests cover the behaviour, including the failure cases
- [ ] `docs/outputs.md` documents any new file or field
- [ ] `npm run typecheck`, `npm run lint` and `npm test` pass

## Out of scope

<!-- What this issue is deliberately NOT asking for. Name the adjacent events
     or outputs that belong to a different issue. -->

## Branch and commits

```sh
git checkout -b feat/some-scoped-branch-name
```

```sh
git commit -m "feat(handlers): what changed"
git commit -m "test(handlers): cover the failure cases"
```

## Notes for contributors

- **Claim the issue before starting.** Comment here so it can be assigned and two
  people do not build the same thing.
- **Write a PR description that says what you did and why**, not one that restates
  the issue. If you made a judgement call, name it.
- **Link the issue** with `Closes #N`.
- **Show it working.** Test output, or the command you ran and what it printed.
- **Real implementations only.** No stubs, no `TODO` where the work should be. If
  you cannot finish in time, open a draft PR and say what is left.
- **Ask here if anything is unclear.** An unclear issue is a defect in the issue,
  not in you.
