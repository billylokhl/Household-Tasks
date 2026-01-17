# Git Commit Instructions

When generating git commit messages, follow the **Conventional Commits** specification. This provides a consistent and readable history for the project.

## Commit Message Format

Each commit message consists of a **header**, a **body**, and a **footer**. The header has a special format that includes a **type**, a **scope**, and a **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

## Line Length Rules

- The **header** line should ideally be **50 characters**, and must not exceed **72 characters**.
- The **body** and **footer** lines should be wrapped at **72 characters**.

## Atomic Commits

- Structure unstaged changes into a series of focused commits where sensible.
- Each commit should be suitably focused and avoid including too many unrelated changes.
- Stage specific hunks within the same file and commit them separately if they belong to different logical changes.

## Header

The **header** is mandatory. The scope of the header is optional.

### Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)
- **ci**: Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Scope

The scope should be the name of the section of the codebase affected (e.g., `deps`, `ui`, `api`, `auth`).

### Subject

The subject contains a succinct description of the change:

- Use the imperative, present tense: "change" not "changed" nor "changes".
- Don't capitalize the first letter.
- No dot (.) at the end.

## Body

The body should include the motivation for the change and contrast this with previous behavior.

- Use the imperative, present tense.
- Can consist of multiple paragraphs.

## Footer

The footer should contain any information about **Breaking Changes** and is also the place to reference GitHub issues that this commit **Closes**.

- **Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

## Examples

**Feature commit:**
```
feat(auth): add login with google support
```

**Bug fix:**
```
fix(api): handle null response in user service
```

**Breaking change:**
```
feat(database): switch to new connection pool library

BREAKING CHANGE: The config object for database connection has changed structure.
```
