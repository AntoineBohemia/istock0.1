"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Organization } from "@/lib/stores/organization-store";
import {
  updateMemberRole,
  removeMember,
  inviteUserToOrganization,
  cancelInvitation,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  uploadOrganizationLogo,
} from "@/lib/supabase/queries/organizations";

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      slug,
      logoUrl,
    }: {
      name: string;
      slug: string;
      logoUrl?: string;
    }) => createOrganization(name, slug, logoUrl),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.organizations.list() });
    },
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; slug?: string; logo_url?: string | null };
    }) => updateOrganization(id, data),
    onMutate: async ({ id, data }) => {
      const key = queryKeys.organizations.list();
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, (old: Organization[] | undefined) =>
        old
          ? old.map((org) => (org.id === id ? { ...org, ...data } : org))
          : old
      );
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        qc.setQueryData(context.key, context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.organizations.list() });
    },
  });
}

export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOrganization(id),
    onMutate: async (id) => {
      const key = queryKeys.organizations.list();
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, (old: Organization[] | undefined) =>
        old ? old.filter((org) => org.id !== id) : old
      );
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        qc.setQueryData(context.key, context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.organizations.list() });
    },
  });
}

export function useUploadOrganizationLogo() {
  return useMutation({
    mutationFn: ({ file, orgSlug }: { file: File; orgSlug: string }) =>
      uploadOrganizationLogo(file, orgSlug),
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      userId,
      role,
    }: {
      organizationId: string;
      userId: string;
      role: "admin" | "member";
    }) => updateMemberRole(organizationId, userId, role),
    onSettled: (_data, _err, { organizationId }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.organizations.members(organizationId),
      });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      userId,
    }: {
      organizationId: string;
      userId: string;
    }) => removeMember(organizationId, userId),
    onMutate: async ({ organizationId, userId }) => {
      const key = queryKeys.organizations.members(organizationId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, (old: any[]) =>
        old ? old.filter((m) => m.user_id !== userId) : old
      );
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        qc.setQueryData(context.key, context.previous);
      }
    },
    onSettled: (_data, _err, { organizationId }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.organizations.members(organizationId),
      });
    },
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      email,
      role,
    }: {
      organizationId: string;
      email: string;
      role?: "admin" | "member";
    }) => inviteUserToOrganization(organizationId, email, role),
    onSettled: (_data, _err, { organizationId }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.organizations.invitations(organizationId),
      });
    },
  });
}

export function useCancelInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      invitationId,
      organizationId,
    }: {
      invitationId: string;
      organizationId: string;
    }) => cancelInvitation(invitationId),
    onMutate: async ({ invitationId, organizationId }) => {
      const key = queryKeys.organizations.invitations(organizationId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, (old: any[]) =>
        old ? old.filter((i) => i.id !== invitationId) : old
      );
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        qc.setQueryData(context.key, context.previous);
      }
    },
    onSettled: (_data, _err, { organizationId }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.organizations.invitations(organizationId),
      });
    },
  });
}
