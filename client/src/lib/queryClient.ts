import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`Making API request: ${method} ${url}`);
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // Include cookies for cross-origin requests
    });

    if (!res.ok) {
      console.error(`API request failed: ${res.status} ${res.statusText}`);
      const errorText = await res.text();
      console.error(`Response body: ${errorText}`);
      throw new Error(`${res.status}: ${errorText || res.statusText}`);
    }
    
    return res;
  } catch (error) {
    console.error(`API request exception:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    // If it's an external URL or starts with http, use it as-is, otherwise prepend with API base URL if needed
    const fullUrl = url.startsWith('http') ? url : url;
    
    console.log(`Making query request: ${fullUrl}`);
    try {
      const res = await fetch(fullUrl, {
        credentials: "include", // Include cookies for cross-origin requests
      });

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
    } catch (error) {
      console.error(`Query request exception for ${fullUrl}:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes instead of Infinity
      retry: 1, // Retry once in case of network errors
    },
    mutations: {
      retry: false,
    },
  },
});
