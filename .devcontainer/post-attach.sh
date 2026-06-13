#!/bin/bash
set -e

echo "=== Auto-pull latest changes ==="

# Stash any local changes
git stash push -m "auto-stash-$(date +%s)" 2>/dev/null || true

# Pull latest from master
git pull origin master 2>/dev/null || echo "No remote changes or no network"

# Restore stashed changes
git stash pop 2>/dev/null || true

echo "=== Done ==="
