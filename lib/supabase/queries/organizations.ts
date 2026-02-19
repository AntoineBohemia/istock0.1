import { createClient } from "@/lib/supabase/client";
import { Organization } from "@/lib/stores/organization-store";

export interface OrganizationMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: string | null;
  is_default: boolean | null;
  created_at: string | null;
  user?: {
    email: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: string | null;
  token: string;
  invited_by: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string | null;
}

/**
 * Récupère les organisations de l'utilisateur connecté
 */
export async function getUserOrganizations(): Promise<Organization[]> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_organizations")
    .select(
      `
      role,
      is_default,
      organization:organizations(id, name, slug, logo_url)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `Erreur lors de la récupération des organisations: ${error.message}`
    );
  }

  return (data || []).map((item) => {
    const org = Array.isArray(item.organization)
      ? item.organization[0]
      : item.organization;
    return {
      id: org?.id || "",
      name: org?.name || "",
      slug: org?.slug || "",
      logo_url: org?.logo_url || null,
      role: item.role as "owner" | "admin" | "member",
    };
  });
}

/**
 * Récupère l'organisation par défaut de l'utilisateur
 */
export async function getDefaultOrganization(): Promise<Organization | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_organizations")
    .select(
      `
      role,
      organization:organizations(id, name, slug, logo_url)
    `
    )
    .eq("user_id", user.id)
    .eq("is_default", true)
    .single();

  if (error) {
    // Si pas d'organisation par défaut, prendre la première
    const orgs = await getUserOrganizations();
    return orgs[0] || null;
  }

  const org = Array.isArray(data.organization)
    ? data.organization[0]
    : data.organization;

  return {
    id: org?.id || "",
    name: org?.name || "",
    slug: org?.slug || "",
    logo_url: org?.logo_url || null,
    role: data.role as "owner" | "admin" | "member",
  };
}

/**
 * Définit l'organisation par défaut de l'utilisateur
 */
export async function setDefaultOrganization(
  organizationId: string
): Promise<void> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Utilisateur non connecté");
  }

  // Retirer le flag is_default de toutes les organisations
  await supabase
    .from("user_organizations")
    .update({ is_default: false })
    .eq("user_id", user.id);

  // Définir la nouvelle organisation par défaut
  const { error } = await supabase
    .from("user_organizations")
    .update({ is_default: true })
    .eq("user_id", user.id)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(
      `Erreur lors de la définition de l'organisation par défaut: ${error.message}`
    );
  }
}

/**
 * Récupère les membres d'une organisation
 */
export async function getOrganizationMembers(
  organizationId: string
): Promise<OrganizationMember[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("user_organizations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `Erreur lors de la récupération des membres: ${error.message}`
    );
  }

  return data || [];
}

/**
 * Met à jour le rôle d'un membre
 */
export async function updateMemberRole(
  organizationId: string,
  userId: string,
  role: "admin" | "member"
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("user_organizations")
    .update({ role })
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      `Erreur lors de la mise à jour du rôle: ${error.message}`
    );
  }
}

/**
 * Retire un membre d'une organisation
 */
export async function removeMember(
  organizationId: string,
  userId: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("user_organizations")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Erreur lors du retrait du membre: ${error.message}`);
  }
}

/**
 * Invite un utilisateur à rejoindre une organisation
 */
export async function inviteUserToOrganization(
  organizationId: string,
  email: string,
  role: "admin" | "member" = "member"
): Promise<OrganizationInvitation> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("organization_invitations")
    .insert({
      organization_id: organizationId,
      email: email.toLowerCase(),
      role,
      invited_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Une invitation a déjà été envoyée à cet email");
    }
    throw new Error(`Erreur lors de l'invitation: ${error.message}`);
  }

  return data;
}

/**
 * Récupère les invitations en attente pour une organisation
 */
export async function getPendingInvitations(
  organizationId: string
): Promise<OrganizationInvitation[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("organization_invitations")
    .select("*")
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `Erreur lors de la récupération des invitations: ${error.message}`
    );
  }

  return data || [];
}

/**
 * Accepte une invitation
 */
export async function acceptInvitation(token: string): Promise<{
  organization: Organization;
}> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Vous devez être connecté pour accepter une invitation");
  }

  // Récupérer l'invitation
  const { data: invitation, error: fetchError } = await supabase
    .from("organization_invitations")
    .select("*, organization:organizations(*)")
    .eq("token", token)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (fetchError || !invitation) {
    throw new Error("Invitation invalide ou expirée");
  }

  // Vérifier que l'email correspond
  if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
    throw new Error(
      "Cette invitation est destinée à une autre adresse email"
    );
  }

  // Ajouter l'utilisateur à l'organisation
  const { error: joinError } = await supabase
    .from("user_organizations")
    .insert({
      user_id: user.id,
      organization_id: invitation.organization_id,
      role: invitation.role,
      is_default: false,
    });

  if (joinError) {
    if (joinError.code === "23505") {
      throw new Error("Vous êtes déjà membre de cette organisation");
    }
    throw new Error(
      `Erreur lors de l'acceptation de l'invitation: ${joinError.message}`
    );
  }

  // Marquer l'invitation comme acceptée
  await supabase
    .from("organization_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  const org = Array.isArray(invitation.organization)
    ? invitation.organization[0]
    : invitation.organization;

  return {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo_url: org.logo_url,
      role: invitation.role as "admin" | "member",
    },
  };
}

/**
 * Annule une invitation
 */
export async function cancelInvitation(invitationId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("organization_invitations")
    .delete()
    .eq("id", invitationId);

  if (error) {
    throw new Error(
      `Erreur lors de l'annulation de l'invitation: ${error.message}`
    );
  }
}

/**
 * Récupère une invitation par son token (pour la page d'acceptation)
 */
export async function getInvitationByToken(
  token: string
): Promise<OrganizationInvitation & { organization: { name: string } } | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("organization_invitations")
    .select("*, organization:organizations(name)")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (error) {
    return null;
  }

  const org = Array.isArray(data.organization)
    ? data.organization[0]
    : data.organization;

  return {
    ...data,
    organization: { name: org?.name || "" },
  };
}

/**
 * Upload un logo d'organisation dans le storage Supabase
 */
export async function uploadOrganizationLogo(
  file: File,
  orgSlug: string
): Promise<string> {
  const supabase = createClient();
  const fileExt = file.name.split(".").pop();
  const fileName = `${orgSlug}-${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage
    .from("organization-logos")
    .upload(fileName, file, { upsert: true });

  if (error) {
    throw new Error(`Erreur lors de l'upload du logo: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from("organization-logos")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Crée une nouvelle organisation via RPC (contourne RLS de manière sécurisée)
 */
export async function createOrganization(
  name: string,
  slug: string,
  logoUrl?: string
): Promise<Organization> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("create_organization_with_owner", {
    org_name: name,
    org_slug: slug,
    org_logo_url: logoUrl || undefined,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ce slug est déjà utilisé par une autre organisation");
    }
    throw new Error(`Erreur lors de la création: ${error.message}`);
  }

  const result = data as unknown as { id: string; name: string; slug: string; logo_url: string | null };

  return {
    id: result.id,
    name: result.name,
    slug: result.slug,
    logo_url: result.logo_url,
    role: "owner",
  };
}

/**
 * Met à jour une organisation
 */
export async function updateOrganization(
  organizationId: string,
  data: { name?: string; slug?: string; logo_url?: string | null }
): Promise<void> {
  const supabase = createClient();

  const updateData: Record<string, unknown> = {};
  if (data.name) updateData.name = data.name;
  if (data.slug) updateData.slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (data.logo_url !== undefined) updateData.logo_url = data.logo_url;

  const { error } = await supabase
    .from("organizations")
    .update(updateData)
    .eq("id", organizationId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ce slug est déjà utilisé par une autre organisation");
    }
    throw new Error(`Erreur lors de la mise à jour: ${error.message}`);
  }
}

/**
 * Supprime une organisation (et toutes ses données)
 */
export async function deleteOrganization(organizationId: string): Promise<void> {
  const supabase = createClient();

  // Vérifier que l'utilisateur est owner
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Utilisateur non connecté");
  }

  const { data: membership } = await supabase
    .from("user_organizations")
    .select("role")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .single();

  if (membership?.role !== "owner") {
    throw new Error("Seul le propriétaire peut supprimer l'organisation");
  }

  // Supprimer l'organisation (les cascades supprimeront les données liées)
  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", organizationId);

  if (error) {
    throw new Error(`Erreur lors de la suppression: ${error.message}`);
  }
}

/**
 * Récupère toutes les organisations (pour l'admin)
 */
export async function getAllOrganizations(): Promise<
  (Organization & { memberCount: number })[]
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("*, user_organizations(count)")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erreur lors de la récupération: ${error.message}`);
  }

  return (data || []).map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo_url: org.logo_url,
    role: "owner" as const,
    memberCount: org.user_organizations?.[0]?.count || 0,
  }));
}
