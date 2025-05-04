// Simple share modal implementation with improved error handling
(function() {
  // Try to initialize when DOM is ready
  function initShareButton() {
    let shareButton = document.getElementById('share-button');
    
    // If button doesn't exist, create one (invisible)
    if (!shareButton) {
      shareButton = document.createElement('button');
      shareButton.id = 'share-button';
      shareButton.style.display = 'none'; // Hide it initially
      document.body.appendChild(shareButton);
      console.log('Created missing share button');
    }
    
    // Add event listener with proper error handling
    try {
      shareButton.addEventListener('click', function() {
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
      });
      console.log('Share button initialized successfully');
    } catch (err) {
      console.log('Error initializing share button:', err);
    }
  }

  // Initialize after DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShareButton);
  } else {
    // DOM already loaded, run now
    initShareButton();
  }

  // Retry after a delay to ensure the DOM is fully ready
  setTimeout(initShareButton, 2000);
})(); 