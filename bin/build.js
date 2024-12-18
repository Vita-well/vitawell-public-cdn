const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const scriptDir = path.resolve(__dirname, '..');
const parentDir = path.resolve(scriptDir, '..');
const cdnBaseUrl = 'https://cdn.jsdelivr.net/gh/Vita-well/vitawell-public-cdn@master';

// Function to run a command asynchronously
const runCommand = (command, options) =>
  new Promise((resolve, reject) => {
    const process = exec(command, options, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
    process.stdout.pipe(process.stdout);
    process.stderr.pipe(process.stderr);
  });

// Function to calculate the hash of a file
const getFileHash = async (filePath) => {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Function to compare and copy files recursively
const compareAndCopy = async (srcDir, destDir, baseUrl, relativePath = '', changedUrls = []) => {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcEntryPath = path.join(srcDir, entry.name);
    const destEntryPath = path.join(destDir, entry.name);
    const entryRelativePath = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      await fs.mkdir(destEntryPath, { recursive: true });
      await compareAndCopy(srcEntryPath, destEntryPath, baseUrl, entryRelativePath, changedUrls);
    } else if (entry.isFile()) {
      const srcHash = await getFileHash(srcEntryPath);
      let destHash;
      try {
        destHash = await getFileHash(destEntryPath);
      } catch {
        destHash = null; // File doesn't exist in the destination
      }

      if (srcHash !== destHash) {
        // Copy the file
        await fs.copyFile(srcEntryPath, destEntryPath);
        // Add the URL to changedUrls
        const fileUrl = `${baseUrl}/${entryRelativePath.replace(/\\/g, '/')}`;
        changedUrls.push(fileUrl);
      }
    }
  }

  return changedUrls;
};

// Main function to process projects
(async () => {
  try {
    const entries = await fs.readdir(parentDir);

    // Filter folders asynchronously
    const folders = (
      await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(parentDir, entry);
          const stats = await fs.stat(entryPath);
          if (
            stats.isDirectory() &&
            entryPath !== scriptDir &&
            entry !== 'vitawell-public-cdn' &&
            entry !== 'node_modules' &&
            entry !== 'vitawell-api-service'  // Added this condition to omit vitawell-api-service
          ) {
            return entry;
          }
          return null;
        })
      )
    ).filter(Boolean);

    // Array to store URLs of changed files
    const changedUrls = [];

    // Iterate through each folder and perform the build and copy
    for (const folder of folders) {
      const folderPath = path.join(parentDir, folder);
      try {
        console.log(`Building project in ${folderPath}...`);
        await runCommand('npm run build', { cwd: folderPath });

        const distPath = path.join(folderPath, 'dist');
        const destinationPath = path.join(scriptDir, 'apps', folder);

        try {
          // Check if the dist folder exists and process it
          await fs.access(distPath);
          console.log(`Copying and comparing dist/ from ${folderPath} to ${destinationPath}...`);
          await compareAndCopy(distPath, destinationPath, `${cdnBaseUrl}/apps/${folder}`, '', changedUrls);
        } catch {
          console.log(`No dist/ folder found in ${folderPath}.`);
        }
      } catch (error) {
        console.error(`Error building project in ${folderPath}:`, error);
      }
    }

    // Output the URLs of changed files
    if (changedUrls.length > 0) {
      console.log('=====================================');
      console.log('Changed files that need to be invalidated:');
      changedUrls.forEach((url) => console.log('-', url));
      console.log('=====================================');
    } else {
      console.log('No changes detected.');
    }

    console.log('All projects processed.');
  } catch (error) {
    console.error('Error in script:', error);
  }
})();