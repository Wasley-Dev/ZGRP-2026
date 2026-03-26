# Desktop Release Checklist

Use this when shipping a new desktop version so every installed client can auto-update.

## 1. Bump version

Update `package.json` `version` to a newer semver than the currently installed app.

## 2. Push a release tag

From `main` (or your release branch), create and push a tag matching the version:

```bash
git tag v0.1.4
git push origin v0.1.4
```

This triggers `.github/workflows/desktop-release.yml`.

## 3. Verify GitHub Release assets

After the workflow finishes, confirm the release contains:

- Windows: `latest.yml`, `*Setup-*.exe`, `*Setup-*.exe.blockmap`
- macOS: `latest-mac.yml`, `*-mac.dmg`, `*-mac.zip`, `*-mac.zip.blockmap`

If these are present, existing desktop users on Windows and macOS will receive the update prompt automatically.

## macOS signing/notarization notes

For macOS downloads to open normally (without "App is damaged" / Gatekeeper warnings), the release workflow expects these GitHub secrets:

- `MAC_CSC_LINK` (base64-encoded `.p12` Developer ID Application cert)
- `MAC_CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
