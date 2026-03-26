const path = require("node:path");
const { notarize } = require("@electron/notarize");

module.exports = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir, packager } = context;

  if (electronPlatformName !== "darwin") return;

  const skip = String(process.env.SKIP_NOTARIZATION || "").toLowerCase();
  if (skip === "true" || skip === "1" || skip === "yes") {
    console.log("[notarize] SKIP_NOTARIZATION set; skipping notarization");
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log(
      "[notarize] Missing APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID; skipping notarization",
    );
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  console.log(`[notarize] Notarizing: ${appPath}`);

  await notarize({
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });
};

