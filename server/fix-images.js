// Fix missing profile images by copying the working ones to create the missing ones
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function main() {
  try {
    // Get all reader profile images from the database
    const readerQuery = "SELECT id, username, full_name, profile_image FROM users WHERE role = 'reader'";
    const { rows: readers } = await pool.query(readerQuery);
    
    console.log(`Found ${readers.length} readers in database`);
    
    // Path to uploads directory - one level up from server directory
    const projectRootDir = path.join(process.cwd(), '..');
    const uploadsDir = path.join(projectRootDir, 'public', 'uploads');
    
    console.log(`Project root directory: ${projectRootDir}`);
    console.log(`Uploads directory: ${uploadsDir}`);
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`Created uploads directory: ${uploadsDir}`);
    }
    
    // Get existing files in uploads directory
    const existingFiles = fs.readdirSync(uploadsDir);
    console.log(`Found ${existingFiles.length} existing files in uploads directory:`);
    existingFiles.forEach(file => console.log(` - ${file}`));
    
    // Create a default file if necessary
    const defaultImagePath = path.join(projectRootDir, 'public', 'images', 'default-profile.jpg');
    const hasDefaultImage = fs.existsSync(defaultImagePath);
    console.log(`Default image exists: ${hasDefaultImage}`);
    
    // Working image sources to use as fallbacks - use the existing files from uploads directory
    let sourceImages = [];
    
    if (existingFiles.length > 0) {
      // Use existing files as source images
      sourceImages = existingFiles.map(file => path.join(uploadsDir, file));
      console.log(`Using ${sourceImages.length} existing files as source images`);
    } else {
      // If no existing files, create a placeholder image
      console.log('No existing files to use as source images, creating a placeholder');
      const placeholderPath = path.join(uploadsDir, 'default-profile.jpg');
      if (hasDefaultImage) {
        fs.copyFileSync(defaultImagePath, placeholderPath);
        console.log(`Copied default image to ${placeholderPath}`);
        sourceImages = [placeholderPath];
      } else {
        // Create a very basic image if nothing else exists
        console.log('No default image found, will use only fallback mechanism');
        sourceImages = [];
      }
    }
    
    let fixedCount = 0;
    let alreadyExistsCount = 0;
    let errorCount = 0;
    
    // For each reader, check if their profile image exists and copy a source image if needed
    for (const reader of readers) {
      try {
        if (!reader.profile_image) {
          console.log(`Reader ${reader.full_name} (ID: ${reader.id}) has no profile image set. Skipping.`);
          continue;
        }
        
        // Extract just the filename from the path
        const imagePath = reader.profile_image;
        let fileName = imagePath;
        
        if (imagePath.includes('/')) {
          fileName = imagePath.split('/').pop();
        }
        
        const fullPath = path.join(uploadsDir, fileName);
        
        // Check if the file already exists
        if (fs.existsSync(fullPath)) {
          console.log(`Profile image for ${reader.full_name} already exists at ${fullPath}`);
          alreadyExistsCount++;
          continue;
        }
        
        // Skip if we don't have any source images to copy from
        if (sourceImages.length === 0) {
          console.log(`Cannot create image for ${reader.full_name} - no source images available`);
          errorCount++;
          continue;
        }
        
        // File doesn't exist, copy a source image
        const sourceIndex = Math.floor(Math.random() * sourceImages.length);
        const sourceImage = sourceImages[sourceIndex];
        
        fs.copyFileSync(sourceImage, fullPath);
        console.log(`Created missing profile image for ${reader.full_name} at ${fullPath}`);
        fixedCount++;
      } catch (err) {
        console.error(`Error processing reader ${reader.full_name} (ID: ${reader.id}):`, err);
        errorCount++;
      }
    }
    
    console.log('\nFix Images Summary:');
    console.log(`- Total readers: ${readers.length}`);
    console.log(`- Images already existed: ${alreadyExistsCount}`);
    console.log(`- Fixed missing images: ${fixedCount}`);
    console.log(`- Errors: ${errorCount}`);
    
  } catch (err) {
    console.error('Error in main function:', err);
  } finally {
    await pool.end();
  }
}

main();