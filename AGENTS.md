# Repository Guidelines

This file is the source of truth for contributors and coding agents working in this repository. Follow these rules unless a more specific `AGENTS.md` exists in a subdirectory.

## Language

- Use English for code identifiers, branch names, commit messages, pull requests, changelog entries, and operational documentation.
- Keep user-facing copy consistent with the language and terminology already used by the affected feature.

## Branching and Pull Requests

- Treat `develop` as the integration branch and the starting point for normal work.
- Treat `main` as the protected, release-only branch. Do not push directly to `main` or `develop`.
- Create short-lived branches from `develop` using one of these prefixes:
  - `feat/` for new behavior.
  - `fix/` for bug fixes.
  - `docs/` for documentation-only changes.
  - `refactor/` for behavior-preserving code changes.
  - `test/` for test-only changes.
  - `chore/` for maintenance and tooling work.
- Use lowercase, hyphen-separated branch descriptions, for example `feat/base-export`.
- Merge normal work back into `develop` through a reviewed pull request after all required checks pass.
- Promote a release through a pull request from `develop` to `main`.
- For an urgent production correction, branch `hotfix/<description>` from `main`, merge it into `main` through a pull request, and merge the same correction back into `develop`.
- Keep pull requests focused. Describe the user-visible result, implementation risks, tests performed, and any changelog or version impact.

## Development Workflow

Use this sequence for every normal change. Replace placeholders with the appropriate branch type, description, commit message, and issue number.

1. Download the latest remote references without modifying local branches:

   ```sh
   git fetch --prune origin
   ```

2. Create a focused local branch directly from the current remote `develop` branch:

   ```sh
   git switch --no-track -c <type>/<short-description> origin/develop
   ```

3. Implement the change, including relevant tests and an `Unreleased` changelog entry when the result is user-visible.

4. Review the working tree before staging anything:

   ```sh
   git status --short
   git diff
   ```

5. Run the required validation:

   ```sh
   pnpm test
   pnpm build
   ```

6. Stage only files that belong to the change and inspect the staged patch:

   ```sh
   git add <files>
   git diff --cached
   ```

7. Create an English Conventional Commit:

   ```sh
   git commit -m "<type>(optional-scope): <description>"
   ```

8. Push the branch without bypassing hooks or checks:

   ```sh
   git push -u origin HEAD
   ```

9. Open a pull request targeting `develop`. Include a summary, test results, changelog impact, and the related issue. Use a closing keyword only when the PR fully satisfies the issue:

   ```sh
   gh pr create --base develop --fill
   ```

10. Address review feedback on the same branch, rerun the required validation, push the follow-up commits, and wait for required checks and approval before merging.

For releases and hotfixes, follow the branch destinations defined in this file instead of targeting `develop` blindly. Never force-push a shared branch, bypass branch protection, or use `--no-verify` to skip repository checks.

## Commits

- Write commit messages in English and follow Conventional Commits: `type(optional-scope): description`.
- Use the types `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, and `revert` as appropriate.
- Use an imperative, concise, lowercase description without a trailing period.
- Mark breaking changes with `!` and explain them in the commit footer using `BREAKING CHANGE:`.
- Do not mix unrelated changes in one commit.

## Issues

- Use a GitHub issue for bugs, features, or tasks that need discussion, acceptance criteria, or coordination before implementation.
- Search existing open and closed issues before creating a new one.
- Write issue titles and descriptions in English and use the appropriate repository issue form.
- Give bugs reproducible steps, expected and actual behavior, environment details, and relevant logs or screenshots.
- Give feature requests a clear problem statement, proposed outcome, alternatives considered, and acceptance criteria.
- Keep one independently deliverable concern per issue. Split work that has unrelated outcomes or cannot be reviewed as one focused change.
- Create the implementation branch from the correct base branch after the issue is understood. Include the issue number in the branch description when useful, for example `fix/42-project-loading`.
- Link the pull request to its issue. Use `Closes #123` or `Fixes #123` only when merging the pull request should close the issue automatically.
- Record material scope changes and decisions in the issue. Do not close an issue until its acceptance criteria are met or a documented decision makes it unnecessary.

## TypeScript and React

- Preserve strict TypeScript typing. Prefer explicit domain types and narrow unions over broad primitives.
- Do not use `any` unless an external boundary makes it unavoidable; document the reason and narrow the value as soon as possible.
- Build React UI with functional components and hooks. Use named exports for application components and utilities.
- Define explicit props interfaces or types near the component that consumes them.
- Use `PascalCase` for components and component files, `camelCase` for functions and variables, and descriptive lowercase filenames for non-component modules.
- Preserve established suffixes such as `.model.ts`, `.repository.ts`, and `.test.tsx`.
- Keep code organized by focused feature. Put shared domain models in `src/models` and genuinely reusable utilities in `src/utils`.
- Keep data access in repository modules rather than embedding persistence logic in UI components.
- Prefer simple, local implementations over speculative abstractions. Extract shared code only when it represents a stable concept or removes meaningful duplication.
- Handle loading, empty, success, and error states explicitly when a feature can produce them.
- Preserve accessibility semantics: use native elements when possible, label controls, support keyboard interaction, and expose state through appropriate ARIA attributes.

## CSS

- Follow the existing global BEM-style naming convention: `.block`, `.block__element`, and `.block--modifier`.
- Give each feature or component a semantic block name and scope its selectors beneath that block. Avoid broad element selectors that can affect unrelated UI.
- Reuse CSS custom properties for colors, spacing, typography, or other design tokens that appear repeatedly. Define shared tokens in `:root` and use component-level variables for local dynamic values.
- Keep layouts responsive. Add or update narrow-viewport behavior when a UI change cannot fit the supported minimum width.
- Provide visible hover, focus, active, and disabled states where applicable. Do not remove focus indicators without an accessible replacement.
- Maintain readable contrast and do not communicate state through color alone.
- Avoid inline styles except for values that are genuinely calculated at runtime. Prefer classes and CSS custom properties for variants.
- Keep selector specificity low, avoid `!important`, and group related rules by block.

## Tests and Validation

- Add or update tests for new behavior, changed behavior, and bug regressions.
- Use Vitest and Testing Library for frontend tests. Prefer queries and interactions that reflect how a user perceives and operates the UI.
- Test observable behavior and public contracts instead of component implementation details.
- Keep tests deterministic and isolate external APIs, persistence, time, or other unstable boundaries with focused fakes or mocks.
- Before marking a pull request ready, run:

  ```sh
  pnpm test
  pnpm build
  ```

- `pnpm coverage` is available for inspection, but the repository does not enforce a numeric coverage threshold.
- Do not weaken, skip, or delete a failing test merely to make validation pass unless the underlying behavior has intentionally changed and the pull request explains why.

## Changelog

- Maintain `CHANGELOG.md` according to Keep a Changelog.
- Add every user-visible change to the `Unreleased` section in the same pull request that introduces it.
- Use the headings `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security` as applicable. Omit empty headings from release sections.
- Changelog entries should describe the impact for users, not internal implementation details.
- Internal chores, refactors, tests, and documentation changes may omit a changelog entry when they have no user-visible effect.

## Versions and Releases

- Follow Semantic Versioning:
  - Increment `MAJOR` for incompatible or breaking changes.
  - Increment `MINOR` for backward-compatible features.
  - Increment `PATCH` for backward-compatible fixes.
- During a release, move applicable entries from `Unreleased` into a `## [X.Y.Z] - YYYY-MM-DD` section and leave a fresh `Unreleased` section at the top.
- Keep the release version synchronized in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`. Include generated lockfile changes when dependency tooling updates them.
- Merge the release pull request from `develop` to `main`, then tag the release commit as `vX.Y.Z`.
- Never publish a version whose tests or production build fail.

## Change Discipline

- Inspect existing code and tests before editing. Preserve unrelated user changes in a dirty worktree.
- Keep changes limited to the requested scope and update documentation when a public workflow or contract changes.
- Do not add dependencies, formatters, linters, code generators, or coverage thresholds without explicit approval.
- Do not commit generated build output such as `dist`, `coverage`, or Tauri build artifacts unless the repository explicitly starts tracking it.
