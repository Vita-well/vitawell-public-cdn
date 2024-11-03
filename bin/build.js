const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define the current execution folder and the parent folder
const currentDir = process.cwd();
const parentDir = path.resolve(currentDir, '..');

// Read all folders in the parent directory
const folders = fs.readdirSync(parentDir).filter((folder) => {
  const folderPath = path.join(parentDir, folder);
  return (
    fs.statSync(folderPath).isDirectory() &&
    folderPath !== currentDir
  );
});

// Function to copy files from source to destination
const copyFolderSync = (src, dest) => {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

// Visit each folder and run the build command
folders.forEach((folder) => {
  const folderPath = path.join(parentDir, folder);
  try {
    console.log(`Building project in ${folderPath}...`);
    execSync('npm run build', { cwd: folderPath, stdio: 'inherit' });

    const distPath = path.join(folderPath, 'dist');
    if (fs.existsSync(distPath)) {
      const destinationPath = path.join(currentDir, 'apps', folder);
      console.log(`Copying dist/ from ${folderPath} to ${destinationPath}...`);
      copyFolderSync(distPath, destinationPath);
    } else {
      console.log(`No dist/ folder found in ${folderPath}.`);
    }
  } catch (error) {
    console.error(`Error building project in ${folderPath}:`, error);
  }
});

console.log('All projects processed.');
