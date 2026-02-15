# Deploy to Free URL (GitHub Pages)

This gives you a public URL your employee can open on iPhone and install to Home Screen.

## 1) Create a GitHub repo
- Create a new public repo on GitHub, for example: `job-costing-pwa`
- Do not add README/license/gitignore from GitHub UI (empty repo is easiest)

## 2) Push this folder to that repo
Run these commands on your Mac:

```bash
cd /Users/janet/Downloads/Codex/JobCostingPWA
git init
git add .
git commit -m "Initial Job Costing PWA"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/job-costing-pwa.git
git push -u origin main
```

If Git asks for credentials, sign in with your GitHub account or use a Personal Access Token.

## 3) Turn on GitHub Pages
1. Open your repo on GitHub.
2. Go to `Settings` -> `Pages`.
3. Under `Build and deployment`:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. Save.

GitHub will publish your site in about 1-3 minutes.

## 4) Open your app URL
Your URL will be:

`https://<YOUR_GITHUB_USERNAME>.github.io/job-costing-pwa/`

## 5) Install on employee iPhone
1. Open the URL in Safari.
2. Tap Share.
3. Tap `Add to Home Screen`.

## Notes
- Data is stored locally on each phone/browser (local storage).
- Saved jobs are exportable to CSV from the `Saved Jobs` tab.
- If browser data is cleared on device, local records are removed.
