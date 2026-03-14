# Setup

## Required Setup (One Time)

The GitHub Action needs a Personal Access Token (PAT) with write access to all registered repos.

**Step 1 — Create a PAT:**
1. Go to GitHub > avatar menu > **Settings**
2. Scroll to **Developer settings** > **Personal access tokens** > **Tokens (classic)**
3. Click **Generate new token (classic)**
4. Name it `claude-config-sync`
5. Check the `repo` scope (full access)
6. Click **Generate token** and copy it — you only see it once

**Step 2 — Add it as a secret in this repo:**
1. Go to `github.com/jykwon91/jkwon-claude-config` > **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret**
3. Name: `SYNC_TOKEN`
4. Value: paste the token
5. Click **Add secret**

## Registering a Project

Add the repo to `projects.txt`:

```
jykwon91/MyBookkeeper
jykwon91/your-new-project
```

On the next push to this repo, the GitHub Action will automatically sync agents and skills to it.

### PAT Access for External Repos

The PAT must have write access to every repo listed in `projects.txt`. This includes:

- Your own repos (public or private) — covered automatically by the `repo` scope
- Organization repos — the PAT owner must have write access to the org repo. You may also need to authorize the PAT for SSO: go to GitHub > Settings > Personal access tokens > find the token > **Configure SSO**
- Repos owned by others — only works if the PAT owner has been granted write access to that repo
