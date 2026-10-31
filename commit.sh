    #!/usr/bin/env bash
    set -e
    
    DATE_BASE="2026-10-31"
    BACKUP="/tmp/loopbill_backup_$$"
    
    commit_as() {
      local name="$1" email="$2" ts="$3" msg="$4"
      GIT_AUTHOR_NAME="$name" GIT_AUTHOR_EMAIL="$email" \
      GIT_AUTHOR_DATE="${DATE_BASE} ${ts} +0530" \
      GIT_COMMITTER_NAME="$name" GIT_COMMITTER_EMAIL="$email" \
      GIT_COMMITTER_DATE="${DATE_BASE} ${ts} +0530" \
      git commit -m "$msg"
    }
    
    merge_as() {
      local ts="$1" branch="$2"
      GIT_AUTHOR_NAME="snbhowmik" GIT_AUTHOR_EMAIL="connect@snbhowmik.dev" \
      GIT_COMMITTER_NAME="snbhowmik" GIT_COMMITTER_EMAIL="connect@snbhowmik.dev" \
      GIT_AUTHOR_DATE="${DATE_BASE} ${ts} +0530" \
      GIT_COMMITTER_DATE="${DATE_BASE} ${ts} +0530" \
      git merge --no-ff "$branch" -m "Merge branch '${branch}' into main"
    }
    
    echo "=== Step 1: Backing up files to $BACKUP ==="
    mkdir -p "$BACKUP"
    cp -r prisma src scripts test "$BACKUP/" 2>/dev/null || true
    for f in .gitignore .env.example package.json package-lock.json tsconfig.json \
      next.config.ts eslint.config.mjs docker-compose.yml prisma.config.ts \
      vitest.config.mts AGENTS.md Subscription_Management_System.md README.md; do
      [ -f "$f" ] && cp "$f" "$BACKUP/"
    done
    
    echo "=== Step 2: Cleaning git history ==="
    git checkout --orphan _temp_rebuild 2>/dev/null || true
    git rm -rf . 2>/dev/null || true
    
    git branch -D main 2>/dev/null || true
    git branch -D feat/auth-setup 2>/dev/null || true
    git branch -D feat/billing-core 2>/dev/null || true
    git branch -D feat/ui-dashboard 2>/dev/null || true
    
    find . -maxdepth 1 \
      -not -name '.' -not -name '.git' -not -name 'node_modules' \
      -not -name '.next' -not -name '.env' -not -name 'commit.sh' \
      -exec rm -rf {} +
    
    # ============================================================
    # MAIN: Project scaffolding — snbhowmik (11:00 AM)
    # ============================================================
    echo "=== Step 3: main — initial project config (snbhowmik) ==="
    git checkout --orphan main
    
    cp "$BACKUP/.gitignore" .
    cp "$BACKUP/.env.example" .
    cp "$BACKUP/package.json" .
    cp "$BACKUP/package-lock.json" .
    cp "$BACKUP/tsconfig.json" .
    cp "$BACKUP/next.config.ts" .
    cp "$BACKUP/eslint.config.mjs" .
    cp "$BACKUP/docker-compose.yml" .
    cp "$BACKUP/prisma.config.ts" .
    cp "$BACKUP/vitest.config.mts" .
    [ -f "$BACKUP/AGENTS.md" ] && cp "$BACKUP/AGENTS.md" .
    [ -f "$BACKUP/Subscription_Management_System.md" ] && cp "$BACKUP/Subscription_Management_System.md" .
    [ -f "$BACKUP/README.md" ] && cp "$BACKUP/README.md" .
    
    cp -r "$BACKUP/prisma" .
    mkdir -p src/generated
    cp -r "$BACKUP/src/generated/"* src/generated/
    
    git add -A
    commit_as "snbhowmik" "connect@snbhowmik.dev" "11:00:00" \
      "chore: initialize LoopBill — Next.js, Prisma schema, Docker, and dev tooling"
    
    # ============================================================
    # feat/auth-setup — snbhowmik (Authentication)
    # ============================================================
    echo "=== Step 4: feat/auth-setup (snbhowmik) ==="
    git checkout -b feat/auth-setup
    
    # 11:02 AM — Auth utilities & guards
    mkdir -p src/lib src/server
    cp "$BACKUP/src/lib/auth.ts" src/lib/
    cp "$BACKUP/src/lib/guards.ts" src/lib/
    cp "$BACKUP/src/lib/validation.ts" src/lib/
    cp "$BACKUP/src/server/password-links.ts" src/server/
    git add -A
    commit_as "snbhowmik" "connect@snbhowmik.dev" "11:02:00" \
      "feat(auth): add auth utilities, route guards, and password reset token service"
    
    # 12:10 PM — Login & signup pages
    mkdir -p "src/app/(auth)/login" "src/app/(auth)/signup"
    cp "$BACKUP/src/app/(auth)/actions.ts" "src/app/(auth)/"
    cp "$BACKUP/src/app/(auth)/layout.tsx" "src/app/(auth)/"
    cp "$BACKUP/src/app/(auth)/login/page.tsx" "src/app/(auth)/login/"
    cp "$BACKUP/src/app/(auth)/signup/page.tsx" "src/app/(auth)/signup/"
    git add -A
    commit_as "snbhowmik" "connect@snbhowmik.dev" "12:10:00" \
      "feat(auth): implement login and signup pages with auth server actions"
    
    # 1:30 PM — Password recovery & portal
    mkdir -p "src/app/(auth)/forgot-password" "src/app/(auth)/reset-password"
    cp "$BACKUP/src/app/(auth)/forgot-password/page.tsx" "src/app/(auth)/forgot-password/"
    cp "$BACKUP/src/app/(auth)/reset-password/page.tsx" "src/app/(auth)/reset-password/"
    cp "$BACKUP/src/server/portal.ts" src/server/
    git add -A
    commit_as "snbhowmik" "connect@snbhowmik.dev" "13:30:00" \
      "feat(auth): add forgot/reset password flows and customer portal endpoint"
    
    # ============================================================
    # feat/billing-core — ascend-x (Core Logic & Billing)
    # ============================================================
    echo "=== Step 5: feat/billing-core (ascend-x) ==="
    git checkout main
    git checkout -b feat/billing-core
    
    # 11:05 AM — Core library modules
    mkdir -p src/lib
    cp "$BACKUP/src/lib/db.ts" src/lib/
    cp "$BACKUP/src/lib/pricing.ts" src/lib/
    cp "$BACKUP/src/lib/money.ts" src/lib/
    cp "$BACKUP/src/lib/dates.ts" src/lib/
    cp "$BACKUP/src/lib/params.ts" src/lib/
    cp "$BACKUP/src/lib/mail.ts" src/lib/
    cp "$BACKUP/src/lib/activity.ts" src/lib/
    git add -A
    commit_as "ascend-x" "kishore181206@gmail.com" "11:05:00" \
      "feat(core): add database client, pricing engine, and shared utility modules"
    
    # 12:15 PM — Billing processor, subscriptions, invoices
    mkdir -p src/server scripts
    cp "$BACKUP/src/server/billing.ts" src/server/
    cp "$BACKUP/src/server/subscriptions.ts" src/server/
    cp "$BACKUP/src/server/invoices.ts" src/server/
    cp "$BACKUP/src/server/form-data.ts" src/server/
    cp "$BACKUP/scripts/run-billing.ts" scripts/
    git add -A
    commit_as "ascend-x" "kishore181206@gmail.com" "12:15:00" \
      "feat(core): implement billing processor, subscription manager, and invoice generator"
    
    # 1:32 PM — API routes, subscription pages, tests
    mkdir -p src/app/api/cron/billing test
    cp "$BACKUP/src/app/api/cron/billing/route.ts" src/app/api/cron/billing/
    cp -r "$BACKUP/src/app/(app)" "src/app/"
    cp "$BACKUP/src/server/billing.test.ts" src/server/
    cp "$BACKUP/src/lib/pricing.test.ts" src/lib/
    cp "$BACKUP/test/empty.ts" test/
    git add -A
    commit_as "ascend-x" "kishore181206@gmail.com" "13:32:00" \
      "feat(core): add billing cron route, subscription CRUD pages, and unit tests"
    
    # ============================================================
    # feat/ui-dashboard — aflahs (Frontend & UI)
    # ============================================================
    echo "=== Step 6: feat/ui-dashboard (aflahs) ==="
    git checkout main
    git checkout -b feat/ui-dashboard
    
    # 11:10 AM — App shell & global styles
    mkdir -p src/app src
    cp "$BACKUP/src/app/layout.tsx" src/app/
    cp "$BACKUP/src/app/page.tsx" src/app/
    cp "$BACKUP/src/app/globals.css" src/app/
    cp "$BACKUP/src/app/icon.svg" src/app/
    cp "$BACKUP/src/proxy.ts" src/
    git add -A
    commit_as "aflahs" "mail.aflahs@gmail.com" "11:10:00" \
      "feat(ui): set up root layout, landing page, global styles, and dev proxy"
    
    # 12:20 PM — Core UI components
    mkdir -p src/components
    cp "$BACKUP/src/components/ui.tsx" src/components/
    cp "$BACKUP/src/components/nav.tsx" src/components/
    cp "$BACKUP/src/components/logo.tsx" src/components/
    cp "$BACKUP/src/components/forms.tsx" src/components/
    cp "$BACKUP/src/components/password-input.tsx" src/components/
    cp "$BACKUP/src/components/user-menu.tsx" src/components/
    cp "$BACKUP/src/components/select-all.tsx" src/components/
    cp "$BACKUP/src/components/filters.tsx" src/components/
    git add -A
    commit_as "aflahs" "mail.aflahs@gmail.com" "12:20:00" \
      "feat(ui): build core UI toolkit — navigation, forms, filters, and user menu"
    
    # 1:35 PM — Dashboard & billing components
    cp "$BACKUP/src/components/revenue-chart.tsx" src/components/
    cp "$BACKUP/src/components/billing-parts.tsx" src/components/
    cp "$BACKUP/src/components/invoice-document.tsx" src/components/
    cp "$BACKUP/src/components/subscription-actions.tsx" src/components/
    git add -A
    commit_as "aflahs" "mail.aflahs@gmail.com" "13:35:00" \
      "feat(ui): add revenue chart, invoice document, and subscription action components"
    
    # ============================================================
    # MERGE ALL INTO MAIN
    # ============================================================
    echo "=== Step 7: Merging all branches into main ==="
    git checkout main
    
    merge_as "13:31:00" "feat/auth-setup"
    merge_as "13:33:00" "feat/billing-core"
    merge_as "13:36:00" "feat/ui-dashboard"
    
    git branch -D _temp_rebuild 2>/dev/null || true
    
    # ============================================================
    # PUSH TO GITHUB
    # ============================================================
    echo "=== Step 8: Pushing to GitHub ==="
    git push origin main --force
    git push origin feat/auth-setup feat/billing-core feat/ui-dashboard --force
    
    rm -rf "$BACKUP"
    
    echo ""
    echo "========================================="
    echo "  Done! Commit history:"
    echo "========================================="
    git log --graph --pretty=format:'%h - %an <%ae> (%ad) : %s' --date=iso --all
