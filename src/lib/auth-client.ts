"use client";

import { createAuthClient } from "better-auth/react";

const baseURL = process.env.NEXT_PUBLIC_APP_URL;

export const authClient = createAuthClient(
  baseURL ? { baseURL } : undefined,
);

/** Reactive session hook: `{ data, isPending, error, refetch }`. */
export const useSession = authClient.useSession;
