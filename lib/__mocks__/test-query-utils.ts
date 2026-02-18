import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Creates a QueryClient configured for testing:
 * - No retries (fail immediately)
 * - No gc delay
 * - No cache time
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Creates a wrapper component for renderHook that provides QueryClientProvider.
 * Optionally accepts an existing QueryClient (useful for mutations tests
 * that need to seed data before rendering).
 */
export function createWrapper(queryClient?: QueryClient) {
  const qc = queryClient ?? createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: qc },
      children
    );
  };
}
