#!/bin/bash
#
# Publish Subdomain Skeleton as GitHub Template
#
# Usage: curl -sSL https://raw.githubusercontent.com/sidekick2020/meeting-scraper/claude/design-system-docs-EpaxI/publish-skeleton.sh | bash
#
# Or download and run: ./publish-skeleton.sh
#

set -e

echo "🚀 Publishing Sober Sidekick Subdomain Skeleton..."
echo ""

# Configuration
REPO_ORG="sidekick2020"
REPO_NAME="subdomain-skeleton"
BRANCH="claude/design-system-docs-EpaxI"
TEMP_DIR=$(mktemp -d)

# Check for gh CLI
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Install it first:"
    echo "   brew install gh"
    echo "   gh auth login"
    exit 1
fi

# Check gh auth
if ! gh auth status &> /dev/null; then
    echo "❌ Not logged into GitHub. Run:"
    echo "   gh auth login"
    exit 1
fi

echo "✓ GitHub CLI authenticated"

# Clone the skeleton from the branch
echo ""
echo "📦 Fetching subdomain-skeleton from meeting-scraper..."
cd "$TEMP_DIR"
git clone --depth 1 --branch "$BRANCH" --single-branch \
    "https://github.com/$REPO_ORG/meeting-scraper.git" source-repo

# Copy skeleton to new directory
echo "📁 Extracting skeleton..."
cp -r source-repo/subdomain-skeleton "$REPO_NAME"
cd "$REPO_NAME"

# Remove any nested .git
rm -rf .git

# Initialize fresh repo
echo "🔧 Initializing git repository..."
git init -b main
git add .
git commit -m "Initial commit - Sober Sidekick subdomain skeleton template

Shared design system for creating consistent subdomain applications.

Includes:
- Design tokens (colors, typography, spacing)
- Pre-built components (buttons, cards, modals, forms)
- Context providers (Theme, Auth, Analytics, DataCache)
- Google Sign-In authentication
- Amplitude analytics integration
- Render.com deployment config"

# Check if repo already exists
echo ""
echo "📡 Creating GitHub repository..."
if gh repo view "$REPO_ORG/$REPO_NAME" &> /dev/null; then
    echo "⚠️  Repository $REPO_ORG/$REPO_NAME already exists."
    read -p "   Delete and recreate? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh repo delete "$REPO_ORG/$REPO_NAME" --yes
        sleep 2
    else
        echo "   Pushing to existing repo..."
        git remote add origin "git@github.com:$REPO_ORG/$REPO_NAME.git"
        git push -u origin main --force
        echo ""
        echo "✅ Updated existing repository!"
        echo "   https://github.com/$REPO_ORG/$REPO_NAME"
        rm -rf "$TEMP_DIR"
        exit 0
    fi
fi

# Create new repo
gh repo create "$REPO_ORG/$REPO_NAME" \
    --public \
    --description "GitHub template for Sober Sidekick subdomain applications with shared design system" \
    --source=. \
    --push

# Enable as template repository
echo ""
echo "🎨 Enabling as template repository..."
gh repo edit "$REPO_ORG/$REPO_NAME" --template

# Add topics
echo "🏷️  Adding topics..."
gh repo edit "$REPO_ORG/$REPO_NAME" \
    --add-topic "react" \
    --add-topic "template" \
    --add-topic "design-system" \
    --add-topic "sober-sidekick"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Successfully published subdomain-skeleton!"
echo ""
echo "📍 Repository: https://github.com/$REPO_ORG/$REPO_NAME"
echo ""
echo "🎯 Users can now:"
echo "   1. Click 'Use this template' on GitHub"
echo "   2. Or run: npx degit $REPO_ORG/$REPO_NAME my-new-app"
echo ""
