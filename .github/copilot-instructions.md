# Graps Running App Conventions

## Commit Messages

- Use Conventional Commits: `type(scope): short imperative summary`.
- Keep the summary to about 72 characters or fewer.
- Use only these types: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`,
  `perf`, and `test`.
- Write commit messages in English and use the imperative mood.
- Wrap the body at about 72 characters. Explain what changed and why, and
  mention affected screens or components where relevant.
- Add a `BREAKING CHANGE:` footer when a change is breaking.
- Keep each commit focused on one logical change.

## Code Conventions

- Use design tokens from `src/theme` for colors, typography, spacing, and
  radius values.
- Reuse components from `src/components` instead of duplicating UI.
- Keep all user-facing UI text in English.
- Use React Native's `Animated` API for animation, with smooth Apple-style
  easing: `Easing.bezier(0.4, 0.0, 0.2, 1)`.
- Avoid adding third-party libraries unless strictly necessary.