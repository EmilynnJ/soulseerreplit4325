// Simple script to build the server without using vite
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create a temporary directory for outputs
const outDir = path.resolve(__dirname, 'dist-temp');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Copy TypeScript files to a temporary directory
console.log('📦 Copying TypeScript files...');
const serverDir = path.resolve(__dirname, 'server');
const sharedDir = path.resolve(__dirname, 'shared');
const tempDir = path.resolve(__dirname, 'temp-build');
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });
fs.mkdirSync(path.join(tempDir, 'server'), { recursive: true });
fs.mkdirSync(path.join(tempDir, 'shared'), { recursive: true });

// Copy server files
copyFilesRecursively(serverDir, path.join(tempDir, 'server'));
// Copy shared files
copyFilesRecursively(sharedDir, path.join(tempDir, 'shared'));

// Replace .js extensions in imports
console.log('🔍 Fixing import statements...');
fixImports(tempDir);

// Compile TypeScript
console.log('🔨 Compiling TypeScript...');
try {
  execSync('npx tsc --project tsconfig.json --outDir dist-temp', { 
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('✅ Compilation successful!');
} catch (error) {
  console.error('❌ Compilation failed:', error.message);
  process.exit(1);
}

// Helper to copy files recursively
function copyFilesRecursively(sourceDir, targetDir) {
  const files = fs.readdirSync(sourceDir);
  
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    const stats = fs.statSync(sourcePath);
    
    if (stats.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      copyFilesRecursively(sourcePath, targetPath);
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

// Helper to fix .js extension imports in TypeScript files
function fixImports(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      fixImports(filePath);
    } else if (file.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      // Remove .js extensions from imports
      content = content.replace(/from ['"](.+)\.js['"]/g, `from '$1'`);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
}

console.log('✨ Build completed!');