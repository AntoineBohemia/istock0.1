import { createClient } from "@/lib/supabase/client";
import { Organization } from "@/lib/stores/organization-store";

export interface OrganizationMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: string | null;
  is_default: boolean | null;
  joined_at: string | null;
  email: string;
  display_name: string;
  avatar_url: string | null;
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

  // La vue n'est pas dans les types générés, on cast
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organization_members_view")
    .select("*")
    .eq("organization_id", organizationId)
    .order("joined_at", { ascending: true });

  if (error) {
    throw new Error(
      `Erreur lors de la récupération des membres: ${error.message}`
    );
  }

  return (data || []) as OrganizationMember[];
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

  // Récupérer le nom de l'org pour l'email
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .single();

  const inviterName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.first_name ||
    user?.email ||
    "Quelqu'un";

  // Envoyer l'email via Edge Function (best-effort, ne bloque pas l'invitation)
  try {
    await supabase.functions.invoke("send-invitation-email", {
      body: {
        email: email.toLowerCase(),
        token: data.token,
        organization_name: org?.name || "Organisation",
        role,
        invited_by_name: inviterName,
      },
    });
  } catch (emailError) {
    console.error("Erreur envoi email invitation:", emailError);
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
 * Accepte une invitation via RPC sécurisé (atomique, avec verrouillage)
 */
export async function acceptInvitation(token: string): Promise<{
  organization: Organization;
}> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("accept_invitation_secure", {
    p_token: token,
  });

  if (error) {
    throw new Error("Erreur lors de l'acceptation de l'invitation");
  }

  const result = data as { success: boolean; error?: string; expected_email?: string; organization?: { id: string; name: string; slug: string; logo_url: string | null }; role?: string };

  if (!result.success) {
    const messages: Record<string, string> = {
      invitation_not_found: "Invitation invalide ou expirée",
      already_accepted: "Cette invitation a déjà été acceptée",
      expired: "Cette invitation a expiré",
      email_mismatch: `Cette invitation est destinée à ${result.expected_email}`,
      already_member: "Vous êtes déjà membre de cette organisation",
    };
    throw new Error(messages[result.error || ""] || "Erreur inconnue");
  }

  return {
    organization: {
      id: result.organization!.id,
      name: result.organization!.name,
      slug: result.organization!.slug,
      logo_url: result.organization!.logo_url,
      role: result.role as "admin" | "member",
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
 * Récupère les détails d'une invitation par token via RPC sécurisé
 */
export async function getInvitationByToken(token: string) {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("get_invitation_details", {
    p_token: token,
  });

  if (error || !data || !data.valid) {
    return null;
  }

  return data as {
    valid: boolean;
    email: string;
    masked_email: string;
    role: string;
    expires_at: string;
    organization_name: string;
    organization_logo_url: string | null;
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

/**
 * Récupère les invitations en attente pour l'utilisateur connecté (par email)
 */
export async function getMyPendingInvitations() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return [];

  const { data, error } = await supabase
    .from("organization_invitations")
    .select("*, organization:organizations(name, logo_url)")
    .eq("email", user.email.toLowerCase())
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) return [];
  return data || [];
}

/**
 * Quitter une organisation via RPC sécurisé
 */
export async function leaveOrganization(
  organizationId: string
): Promise<{ action: string }> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("leave_organization", {
    p_organization_id: organizationId,
  });

  if (error) {
    throw new Error(`Erreur: ${error.message}`);
  }

  const result = data as { success: boolean; error?: string; message?: string; action?: string };

  if (!result.success) {
    const messages: Record<string, string> = {
      not_member: "Vous n'êtes pas membre de cette organisation",
      owner_must_transfer:
        "Vous devez transférer la propriété avant de quitter",
    };
    throw new Error(messages[result.error || ""] || result.message || "Erreur inconnue");
  }

  return { action: result.action || "left" };
}

/**
 * Transférer la propriété d'une organisation via RPC sécurisé
 */
export async function transferOwnership(
  organizationId: string,
  newOwnerId: string
): Promise<void> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("transfer_ownership", {
    p_organization_id: organizationId,
    p_new_owner_id: newOwnerId,
  });

  if (error) {
    throw new Error(`Erreur: ${error.message}`);
  }

  const result = data as { success: boolean; error?: string };

  if (!result.success) {
    const messages: Record<string, string> = {
      not_owner: "Seul le propriétaire peut transférer la propriété",
      target_not_member: "Cet utilisateur n'est pas membre de l'organisation",
      same_user: "Vous ne pouvez pas transférer à vous-même",
    };
    throw new Error(messages[result.error || ""] || "Erreur inconnue");
  }
}
