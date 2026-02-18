"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import {
  getUserOrganizations,
  getOrganizationMembers,
  getPendingInvitations,
} from "@/lib/supabase/queries/organizations";

export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.organizations.list(),
    queryFn: () => getUserOrganizations(),
    staleTime: STALE_TIME.SLOW,
  });
}

export function useOrganizationMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.members(orgId!),
    queryFn: () => getOrganizationMembers(orgId!),
    enabled: !!orgId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function usePendingInvitations(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.invitations(orgId!),
    queryFn: () => getPendingInvitations(orgId!),
    enabled: !!orgId,
    staleTime: STALE_TIME.SLOW,
  });
}
