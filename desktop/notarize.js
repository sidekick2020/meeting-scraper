const { notarize } = require('@electron/notarize');

// Timeout for notarization (25 minutes - allows time for retry within 45 min job limit)
const NOTARIZE_TIMEOUT_MS = 25 * 60 * 1000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 30 * 1000; // 30 seconds between retries

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    )
  ]);
}

async function notarizeWithRetry(appPath, credentials, attempt = 1) {
  console.log(`🔐 Notarization attempt ${attempt}/${MAX_RETRIES + 1}...`);
  console.log(`   App: ${appPath}`);
  console.log(`   Timeout: ${NOTARIZE_TIMEOUT_MS / 1000 / 60} minutes`);

  const startTime = Date.now();

  // Log progress every 2 minutes
  const progressInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000 / 60);
    console.log(`   ⏳ Notarization in progress... (${elapsed} min elapsed)`);
  }, 2 * 60 * 1000);

  try {
    await withTimeout(
      notarize({
        appPath,
        appleId: credentials.appleId,
        appleIdPassword: credentials.appleIdPassword,
        teamId: credentials.teamId,
      }),
      NOTARIZE_TIMEOUT_MS,
      `Notarization timed out after ${NOTARIZE_TIMEOUT_MS / 1000 / 60} minutes`
    );

    clearInterval(progressInterval);
    const duration = Math.floor((Date.now() - startTime) / 1000 / 60);
    console.log(`✅ Notarization complete! (took ${duration} minutes)`);
    return true;
  } catch (error) {
    clearInterval(progressInterval);
    console.error(`❌ Notarization attempt ${attempt} failed: ${error.message}`);

    if (attempt <= MAX_RETRIES) {
      console.log(`   Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
      await sleep(RETRY_DELAY_MS);
      return notarizeWithRetry(appPath, credentials, attempt + 1);
    }

    throw error;
  }
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Skip notarization if SKIP_NOTARIZATION env var is set (for test builds)
  if (process.env.SKIP_NOTARIZATION === 'true') {
    console.log('⚡ Skipping notarization (SKIP_NOTARIZATION=true)');
    return;
  }

  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log('⚠️ Skipping notarization: missing credentials');
    console.log('   Required: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  🍎 Apple Notarization');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  await notarizeWithRetry(appPath, {
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
