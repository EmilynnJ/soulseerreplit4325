// Simple share modal implementation with improved error handling
(function() {
  // Wait for document to be fully loaded
  function initShareButton() {
    try {
      const shareButton = document.getElementById('share-button');
      
      // If button doesn't exist, create one (invisible)
      if (shareButton) {
        // Button exists, add event listener with proper error handling
        try {
          shareButton.addEventListener('click', handleShareClick);
          console.log('Share button initialized successfully');
        } catch (err) {
          console.log('Error initializing share button:', err);
        }
      } else {
        // Create the button only if we're on a page that should have sharing
        // This helps avoid unnecessary DOM manipulation
        if (document.body) {
          const newShareButton = document.createElement('button');
          newShareButton.id = 'share-button';
          newShareButton.style.display = 'none'; // Hide it initially
          document.body.appendChild(newShareButton);
          
          // Now add the event listener
          newShareButton.addEventListener('click', handleShareClick);
          console.log('Created and initialized share button');
        } else {
          // Document body isn't ready yet, this shouldn't happen if we're using DOMContentLoaded
          console.log('Document body not ready for share button creation');
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

  // Initialize safely when DOM is loaded
  if (document.readyState === 'loading') {
    // Still loading, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', initShareButton);
  } else {
    // DOM already loaded, run now
    initShareButton();
  }

  // Extra safety - retry after a delay
  setTimeout(initShareButton, 2000);
})(); 