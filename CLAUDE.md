# Claude Code Instructions

This document provides guidance for Claude Code sessions working on this repository.

## Release Versioning Workflow

When making changes that warrant a new version release, follow this process:

### 1. Update the CHANGELOG

Add a new version entry to `CHANGELOG.md` following the existing format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### New Features
- **Feature Name**: Description

### Bug Fixes
- **Fix Name**: Description

### UI/UX Improvements
- Description of improvement
```

### 2. Create a Git Tag (Important Limitation)

**Claude cannot push git tags** due to authentication restrictions. Claude's git credentials only allow pushing to branches matching `claude/*`.

After updating the CHANGELOG, Claude should:

1. Create the tag locally:
   ```bash
   git tag -a vX.Y.Z <commit-hash> -m "Release vX.Y.Z - Summary"
   ```

2. Inform the user that the tag needs to be pushed manually:
   ```bash
   git push origin vX.Y.Z
   ```

### 3. Why Tags Matter

The `/api/versions` endpoint reads git tags to populate the Release History in the Settings modal. Without a pushed tag, versions won't appear in the UI even if they're documented in the CHANGELOG.

## Version Number Guidelines

- **Major (X.0.0)**: Breaking changes or major new functionality
- **Minor (X.Y.0)**: New features, significant enhancements
- **Patch (X.Y.Z)**: Bug fixes, small improvements

## Current Pending Tags

The following tags have been created locally but need to be pushed by a user with full git access:

| Version | Commit | Status |
|---------|--------|--------|
| v1.6.0 | 3c419bf | Created locally, needs push |

To push pending tags:
```bash
git fetch --tags
git push origin v1.6.0
```

## Commit Message Format

When updating the CHANGELOG for a new version, use a commit message like:

```
Release vX.Y.Z - Brief summary

- Feature 1
- Feature 2
- Bug fix
```

## API Versions vs Application Versions

This project has two distinct version concepts:

1. **API Versions** (`v1`, `v2-beta`): Defined in `backend/app.py` `API_VERSIONS` constant. These are endpoint versioning for the API.

2. **Application Versions** (`1.5.0`, `1.6.0`): Git tags representing releases. Shown in Release History UI.

Don't confuse these - adding a CHANGELOG entry for v1.6.0 doesn't create a new API version.
