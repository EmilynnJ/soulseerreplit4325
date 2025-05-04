// Simple share modal implementation
document.addEventListener('DOMContentLoaded', function() {
  const shareButton = document.getElementById('share-button');
  
  if (shareButton) {
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
        // Fallback for browsers that don't support navigator.share
        console.log('Web Share API not supported');
        // You could implement a custom share modal here
      }
    });
  } else {
    console.log('Share button not found, will initialize later');
    
    // Try again after a short delay
    setTimeout(() => {
      const shareButtonRetry = document.getElementById('share-button');
      if (shareButtonRetry) {
        shareButtonRetry.addEventListener('click', function() {
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
          }
        });
      }
    }, 2000);
  }
}); 