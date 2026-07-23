"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRightLeft,
  Copy,
  Crown,
  Loader2,
  Mail,
  MoreHorizontal,
  Shield,
  User,
  UserMinus,
  UserPlus,
  Users,
  Clock,
  X,
  Send,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { OrganizationMember } from "@/lib/supabase/queries/organizations";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationMembers, usePendingInvitations } from "@/hooks/queries";
import {
  useUpdateMemberRole,
  useRemoveMember,
  useInviteUser,
  useCancelInvitation,
  useResendInvitation,
  useTransferOwnership,
} from "@/hooks/mutations";

type MemberWithEmail = OrganizationMember;

const roleLabels: Record<string, { label: string; icon: React.ElementType }> = {
  owner: { label: "Propriétaire", icon: Crown },
  admin: { label: "Administrateur", icon: Shield },
  member: { label: "Membre", icon: User },
};

export default function MembersPage() {
  const { currentOrganization } = useOrganizationStore();
  const { data: members = [], isLoading: isLoadingMembers } = useOrganizationMembers(
    currentOrganization?.id
  );

  const canManageMembers =
    currentOrganization?.role === "owner" || currentOrganization?.role === "admin";

  const { data: invitations = [], isLoading: isLoadingInvitations } = usePendingInvitations(
    canManageMembers ? currentOrganization?.id : undefined
  );

  const updateRoleMutation = useUpdateMemberRole();
  const removeMemberMutation = useRemoveMember();
  const inviteUserMutation = useInviteUser();
  const cancelInvitationMutation = useCancelInvitation();
  const resendInvitationMutation = useResendInvitation();
  const transferOwnershipMutation = useTransferOwnership();

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  // Lien de secours, affiché quand l'email n'est pas parti : un lien qu'on doit
  // partager a la main ne doit pas vivre seulement dans un toast qui disparait.
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<MemberWithEmail | null>(null);
  const [memberToTransfer, setMemberToTransfer] = useState<MemberWithEmail | null>(null);
  const [transferConfirmName, setTransferConfirmName] = useState("");

  const [memberSearch, setMemberSearch] = useState("");

  const filteredMembers = useMemo(() => {
    if (!memberSearch) return members;
    const q = memberSearch.toLowerCase();
    return members.filter(
      (m) =>
        (m.display_name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q)
    );
  }, [members, memberSearch]);

  const isLoading = isLoadingMembers || isLoadingInvitations;
  const isSubmitting = removeMemberMutation.isPending || inviteUserMutation.isPending;

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Lien d'invitation copié !");
  };

  // Get current user ID
  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        setCurrentUserId(user?.id || null);
      })
      .catch(() => {});
  }, []);

  const handleInvite = () => {
    if (!currentOrganization || !inviteEmail.trim()) return;

    inviteUserMutation.mutate(
      {
        organizationId: currentOrganization.id,
        email: inviteEmail.trim(),
        role: inviteRole,
      },
      {
        onSuccess: (result) => {
          const link = `${window.location.origin}/invite/${result.invitation.token}`;
          if (result.emailSent) {
            // L'email est parti : rien a partager a la main, on referme.
            navigator.clipboard.writeText(link);
            toast.success("Invitation envoyée par email à " + inviteEmail.trim(), {
              duration: 5000,
            });
            setIsInviteDialogOpen(false);
            setInviteEmail("");
            setInviteRole("member");
          } else {
            // Email non configuré ou en echec : on garde la fenetre ouverte et on
            // montre le lien, plutot que de le cacher dans un toast.
            setFallbackLink(link);
            setLinkCopied(false);
            navigator.clipboard.writeText(link).then(() => setLinkCopied(true));
          }
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Erreur lors de l'invitation");
        },
      }
    );
  };

  const handleUpdateRole = (userId: string, newRole: "admin" | "member") => {
    if (!currentOrganization) return;

    updateRoleMutation.mutate(
      { organizationId: currentOrganization.id, userId, role: newRole },
      {
        onSuccess: () => toast.success("Rôle mis à jour"),
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
        },
      }
    );
  };

  const handleRemoveMember = () => {
    if (!currentOrganization || !memberToRemove) return;

    removeMemberMutation.mutate(
      { organizationId: currentOrganization.id, userId: memberToRemove.user_id },
      {
        onSuccess: () => {
          toast.success("Membre retiré de l'organisation");
          setIsDeleteDialogOpen(false);
          setMemberToRemove(null);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Erreur lors du retrait");
        },
      }
    );
  };

  const handleCancelInvitation = (invitationId: string) => {
    if (!currentOrganization) return;

    cancelInvitationMutation.mutate(
      { invitationId, organizationId: currentOrganization.id },
      {
        onSuccess: () => toast.success("Invitation annulée"),
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Erreur lors de l'annulation");
        },
      }
    );
  };

  const handleResendInvitation = (invitationId: string) => {
    if (!currentOrganization) return;

    resendInvitationMutation.mutate(
      { invitationId, organizationId: currentOrganization.id },
      {
        onSuccess: (result) => {
          if (result.emailSent) {
            toast.success("Invitation renvoyée par email !");
          } else {
            toast.warning("Invitation renouvelée mais l'email n'a pas pu être envoyé.");
          }
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Erreur lors du renvoi");
        },
      }
    );
  };

  const handleTransferOwnership = () => {
    if (!currentOrganization || !memberToTransfer) return;

    transferOwnershipMutation.mutate(
      {
        organizationId: currentOrganization.id,
        newOwnerId: memberToTransfer.user_id,
      },
      {
        onSuccess: () => {
          toast.success(
            `Propriété transférée à ${memberToTransfer.display_name || memberToTransfer.email}`
          );
          setIsTransferDialogOpen(false);
          setMemberToTransfer(null);
          setTransferConfirmName("");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Erreur lors du transfert");
        },
      }
    );
  };

  const openRemoveDialog = (member: MemberWithEmail) => {
    setMemberToRemove(member);
    setIsDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56 mt-1" />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Skeleton className="h-3 w-14" />
                  </TableHead>
                  <TableHead>
                    <Skeleton className="h-3 w-10" />
                  </TableHead>
                  <TableHead>
                    <Skeleton className="h-3 w-16" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(4)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-36" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-3 w-20" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentOrganization) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        Aucune organisation sélectionnée
      </div>
    );
  }

  const actionSlot =
    typeof document !== "undefined" ? document.getElementById("settings-action-slot") : null;

  return (
    <div className="space-y-6">
      {canManageMembers &&
        actionSlot &&
        createPortal(
          <Button onClick={() => setIsInviteDialogOpen(true)}>
            <UserPlus className="mr-2 size-4" />
            Inviter un membre
          </Button>,
          actionSlot
        )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Membres de l'équipe</CardTitle>
              <CardDescription>
                {members.length} membre{members.length > 1 ? "s" : ""} dans cette organisation
              </CardDescription>
            </div>
            {members.length > 3 && (
              <SearchInput
                value={memberSearch}
                onChange={setMemberSearch}
                placeholder="Rechercher..."
                className="h-9"
                wrapperClassName="w-64"
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Ajouté le</TableHead>
                {canManageMembers && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManageMembers ? 4 : 3}>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted mb-3">
                        <Users className="size-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {memberSearch
                          ? "Aucun membre ne correspond à cette recherche."
                          : "Aucun membre dans cette organisation."}
                      </p>
                      {!memberSearch && canManageMembers && (
                        <Button
                          variant="outline"
                          className="mt-3"
                          onClick={() => setIsInviteDialogOpen(true)}
                        >
                          <UserPlus className="mr-2 size-4" />
                          Inviter un membre
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member) => {
                  const RoleIcon = roleLabels[member.role ?? ""]?.icon || User;
                  const isCurrentUser = member.user_id === currentUserId;
                  const isOwner = member.role === "owner";

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            {member.avatar_url && (
                              <AvatarImage src={member.avatar_url} alt={member.display_name} />
                            )}
                            <AvatarFallback className="text-xs">
                              {(member.display_name || member.email || "?")
                                .substring(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {member.display_name || member.email}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isOwner ? "default" : "secondary"} className="gap-1">
                          <RoleIcon className="size-3" />
                          {roleLabels[member.role ?? ""]?.label || member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(member.joined_at ?? 0).toLocaleDateString("fr-FR")}
                        </span>
                      </TableCell>
                      {canManageMembers && (
                        <TableCell>
                          {!isOwner && !isCurrentUser && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  aria-label="Actions"
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {member.role === "member" && (
                                  <DropdownMenuItem
                                    onClick={() => handleUpdateRole(member.user_id, "admin")}
                                  >
                                    <Shield className="mr-2 size-4" />
                                    Promouvoir admin
                                  </DropdownMenuItem>
                                )}
                                {member.role === "admin" && (
                                  <DropdownMenuItem
                                    onClick={() => handleUpdateRole(member.user_id, "member")}
                                  >
                                    <User className="mr-2 size-4" />
                                    Rétrograder membre
                                  </DropdownMenuItem>
                                )}
                                {currentOrganization?.role === "owner" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setMemberToTransfer(member);
                                        setTransferConfirmName("");
                                        setIsTransferDialogOpen(true);
                                      }}
                                    >
                                      <ArrowRightLeft className="mr-2 size-4" />
                                      Transférer la propriété
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openRemoveDialog(member)}
                                  className="text-destructive"
                                >
                                  <UserMinus className="mr-2 size-4" />
                                  Retirer de l'organisation
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {canManageMembers && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5" />
              Invitations en attente
            </CardTitle>
            <CardDescription>
              {invitations.length} invitation(s) en attente de réponse
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="size-4 text-muted-foreground" />
                        <span>{invitation.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {roleLabels[invitation.role ?? ""]?.label || invitation.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(invitation.expires_at ?? 0).toLocaleDateString("fr-FR")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleResendInvitation(invitation.id)}
                          title="Renvoyer l'invitation"
                          disabled={resendInvitationMutation.isPending}
                        >
                          <Send className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => copyInviteLink(invitation.token)}
                          title="Copier le lien d'invitation"
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => handleCancelInvitation(invitation.id)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog
        open={isInviteDialogOpen}
        onOpenChange={(o) => {
          setIsInviteDialogOpen(o);
          // Fermer la fenetre efface le lien de secours : il appartient a
          // l'invitation qu'on vient d'envoyer, pas a la suivante.
          if (!o) {
            setFallbackLink(null);
            setInviteEmail("");
            setInviteRole("member");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inviter un membre</DialogTitle>
            <DialogDescription>
              Envoyez une invitation par email pour rejoindre {currentOrganization.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="exemple@email.com"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Rôle</Label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                disabled={isSubmitting}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="member">Membre</option>
                <option value="admin">Administrateur</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {inviteRole === "admin"
                  ? "Accès complet : peut inviter, gérer les membres et accéder à toutes les pages."
                  : "Accès restreint : peut uniquement utiliser les Actions rapides (entrées/sorties stock)."}
              </p>
            </div>

            {/* Lien de secours : l'invitation est créée, mais l'email n'est pas
                parti (envoi non configuré ou en échec). On donne le lien à
                partager soi-même plutôt que de renvoyer sur un email absent. */}
            {fallbackLink && (
              <div className="rounded-lg border border-attention/30 bg-attention-bg/40 p-3">
                <p className="text-sm font-medium">
                  Invitation créée, mais l&apos;email n&apos;a pas pu être envoyé.
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Copiez ce lien et transmettez-le à {inviteEmail.trim()} vous-même. Il devra se
                  connecter avec cette adresse.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Input readOnly value={fallbackLink} className="h-8 text-xs" />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(fallbackLink);
                      setLinkCopied(true);
                    }}
                  >
                    {linkCopied ? "Copié !" : "Copier"}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsInviteDialogOpen(false)}
              disabled={isSubmitting}
            >
              {fallbackLink ? "Fermer" : "Annuler"}
            </Button>
            {!fallbackLink && (
              <Button onClick={handleInvite} disabled={isSubmitting || !inviteEmail.trim()}>
                {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Envoyer l'invitation
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transférer la propriété</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de transférer la propriété de{" "}
              <strong>{currentOrganization?.name}</strong> à{" "}
              <strong>{memberToTransfer?.display_name || memberToTransfer?.email}</strong>
              .
              <br />
              <br />
              Vous deviendrez administrateur. Cette action est difficilement réversible — seul le
              nouveau propriétaire pourra vous redonner ce rôle.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="confirm-name">
              Tapez <strong>{currentOrganization?.name}</strong> pour confirmer
            </Label>
            <Input
              id="confirm-name"
              value={transferConfirmName}
              onChange={(e) => setTransferConfirmName(e.target.value)}
              placeholder={currentOrganization?.name}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleTransferOwnership}
              disabled={
                transferConfirmName !== currentOrganization?.name ||
                transferOwnershipMutation.isPending
              }
            >
              {transferOwnershipMutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Transférer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer ce membre</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir retirer ce membre de l'organisation ? Il perdra l'accès à
              toutes les données de {currentOrganization.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isSubmitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
