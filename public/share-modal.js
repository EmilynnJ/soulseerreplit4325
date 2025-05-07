// Simple share modal implementation with improved error handling
(function() {
  // Wait for document to be fully loaded
  function initShareButton() {
    try {
      const shareButton = document.getElementById('share-button');
      
      // Safely add event listener only if button exists
      if (shareButton) {
        // Button exists, add event listener with proper error handling
        try {
          shareButton.addEventListener('click', handleShareClick);
          console.log('Share button initialized successfully');
        } catch (err) {
          console.log('Error initializing share button:', err);
        }
      } else {
        // Only attempt to create a button if we're on an appropriate page
        // Don't create buttons on error pages or before DOM is ready
        if (document.body && !window.location.pathname.includes('error')) {
          try {
            const newShareButton = document.createElement('button');
            newShareButton.id = 'share-button';
            newShareButton.style.display = 'none'; // Hide it initially
            document.body.appendChild(newShareButton);
            
            // Now add the event listener
            newShareButton.addEventListener('click', handleShareClick);
            console.log('Created and initialized share button');
          } catch (err) {
            console.log('Error creating share button:', err);
          }
        } else {
          // Document body isn't ready yet or we're on an error page
          console.log('Skipping share button creation (body not ready or error page)');
        }
      }
    } catch (err) {
      console.log('Error in share button initialization:', err);
    }
  }
  
  // Separate function for share handling
  function handleShareClick() {
    if (navigator.share) {
      navigator.share({
        title: 'SoulSeer - Psychic Readings',
        text: 'Connect with professional readers for guidance and insight',
        url: window.location.href
      })
      .then(() => console.log('Share successful'))
      .catch((error) => console.log('Error sharing:', error));
    } else {
      console.log('Web Share API not supported');
      // You could implement a custom share modal here
    }
  }

  // Initialize with a safe approach
  // Wait until interactive or complete before trying to initialize
  if (document.readyState === 'loading') {
    // Still loading, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', initShareButton);
  } else {
    // DOM already ready (interactive or complete), run now
    setTimeout(initShareButton, 0); // Use setTimeout to avoid blocking
  }

  // Remove the timeout retry to avoid duplicates
})(); 