import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Throw an error if the response is not okay
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Base API request function with improved error handling and logging
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`Making API request: ${method} ${url}`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout
  
  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        "Accept": "application/json",
        "Cache-Control": "no-cache",
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // Include cookies for cross-origin requests
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`API request failed: ${res.status} ${res.statusText}`);
      const errorText = await res.text();
      console.error(`Response body: ${errorText}`);
      throw new Error(`${res.status}: ${errorText || res.statusText}`);
    }
    
    return res;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Improve error message for timeout/network errors
    if (error.name === 'AbortError') {
      console.error(`API request timed out: ${method} ${url}`);
      throw new Error(`Request timed out. Please check your internet connection and try again.`);
    }
    
    console.error(`API request exception:`, error);
    throw error;
  }
}

/**
 * Enhanced query function with improved error handling and retries
 */
type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    // Ensure API URL has /api prefix for relative URLs
    const fullUrl = url.startsWith('http') || url.startsWith('/api') 
      ? url 
      : `/api${url.startsWith('/') ? url : `/${url}`}`;
    
    console.log(`Making query request: ${fullUrl}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout
    
    try {
      const res = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          "Accept": "application/json",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive" // Encourage connection reuse
        },
        credentials: "include", // Include cookies for cross-origin requests
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        console.log(`Auth required for ${fullUrl}, returning null as configured`);
        return null;
      }

      if (!res.ok) {
        console.error(`Query request failed: ${res.status} ${res.statusText}`);
        const errorText = await res.text();
        console.error(`Response body: ${errorText}`);
        throw new Error(`${res.status}: ${errorText || res.statusText}`);
      }
      
      const data = await res.json();
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // Improve error message for timeout/network errors
      if (error.name === 'AbortError') {
        console.error(`Query request timed out: ${fullUrl}`);
        throw new Error(`Request timed out. Please check your internet connection and try again.`);
      }
      
      console.error(`Query request exception for ${fullUrl}:`, error);
      throw error;
    }
  };

// Configure QueryClient with increased retry logic and caching
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2, // 2 minutes stale time to reduce requests
      gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors except 408 (timeout) and 429 (too many requests)
        if (error instanceof Error) {
          const status = parseInt(error.message.split(':')[0]);
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            return false;
          }
        }
        return failureCount < 2; // Retry up to 2 times
      },
      retryDelay: attempt => Math.min(1000 * 2 ** attempt, 10000), // Exponential backoff with max of 10s
    },
    mutations: {
      retry: 1, // Retry once for mutations too
      retryDelay: 1000, // 1 second delay for mutation retries
    },
  },
});
