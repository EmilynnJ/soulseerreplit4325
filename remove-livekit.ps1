$routesFilePath = ".\server\routes.ts"
$content = Get-Content $routesFilePath -Raw

# 1. Remove LiveKit reference in POST /api/livestreams endpoint
$pattern1 = '// Create livestream via our LiveKit-based solution\s*const liveKitService = require\(''./services/livekit-service''\);\s*const livestream = await liveKitService.createLivestream\(req.user, title, description\);'
$replacement1 = '// Create livestream using the updated LivestreamService (which uses WebRTC)
      const livestream = await livestreamService.createLivestream(req.user!, title, description, category, scheduledFor ? new Date(scheduledFor) : undefined);'
$content = $content -replace $pattern1, $replacement1

# 2. Remove LiveKit reference in GET /api/livestreams endpoint
$pattern2 = '// Make sure LiveKit service is available\s*const liveKitService = require\(''./services/livekit-service''\);\s*if \(userId\) \{\s*log\(`Fetching livestreams for user ID: \${userId}`, ''routes''\);\s*livestreams = await liveKitService.getLivestreamsForUser\(userId\);\s*\} else \{\s*log\(''Fetching public livestreams'', ''routes''\);\s*livestreams = await liveKitService.getPublicLivestreams\(\);'
$replacement2 = '// Fetch livestreams using the storage layer directly
      if (userId) {
        log(`Fetching livestreams for user ID: ${userId}`, ''routes'');
        livestreams = await storage.getLivestreamsByUserId(parseInt(userId, 10));
      } else {
        log(''Fetching public livestreams'', ''routes'');
        // Assuming a method exists or needs to be added to fetch public/active streams
        // For now, let''s get all - adjust based on actual public logic needed
        livestreams = await storage.getAllLivestreams();'

$content = $content -replace $pattern2, $replacement2

# 3. Remove LiveKit reference in GET /api/livestreams/:id endpoint
$pattern3 = '// Get the livestream details using LiveKit\s*const liveKitService = require\(''./services/livekit-service''\);\s*const livestream = await liveKitService.getLivestreamDetails\(id\);'
$replacement3 = '// Get livestream details using storage directly
      const livestream = await storage.getLivestreamById(id);'
$content = $content -replace $pattern3, $replacement3

# 4. Remove LiveKit token routes
$pattern4 = '// API endpoint to start a LiveKit livestream(.*?)// API endpoint to end a LiveKit livestream'
$content = $content -replace $pattern4, '// WebRTC livestream endpoints are handled elsewhere'

$pattern5 = '// LiveKit token routes are now in place above'
$replacement5 = '// WebRTC token routes are handled elsewhere'
$content = $content -replace $pattern5, $replacement5

# 5. Remove any remaining /api/livekit endpoints
$pattern6 = 'app\.post\(''/api/livekit/(.*?)\}'
$content = $content -replace $pattern6, ''

Set-Content -Path $routesFilePath -Value $content

Write-Host "LiveKit references removed from routes.ts"
