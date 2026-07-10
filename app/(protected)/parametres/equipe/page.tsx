"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Copy,
  Crown,
  Loader2,
  Mail,
  MoreHorizontal,
  Shield,
  Search,
  User,
  UserMinus,
  UserPlus,
  Users,
  Clock,
  X,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useTransferOwnership,
} from "@/hooks/mutations";

type MemberWithEmail = OrganizationMember;

const roleLabels: Record<string, { label: string; icon: React.ElementType }> = {
  owner: { label: "Propriétaire", icon: Crown },
  admin: { label: "Administrateur", icon: Shield },
  member: { label: "Membre", icon: User },
  guest: { label: "Invité", icon: Eye },
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
  const transferOwnershipMutation = useTransferOwnership();

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "guest">("member");
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    }).catch(() => {});
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
        onSuccess: (data) => {
          const link = `${window.location.origin}/invite/${data.token}`;
          navigator.clipboard.writeText(link);
          toast.success(`Invitation créée ! Lien copié dans le presse-papier.`, {
            duration: 5000,
          });
          setIsInviteDialogOpen(false);
          setInviteEmail("");
          setInviteRole("member");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Erreur lors de l'invitation");
        },
      }
    );
  };

  const handleUpdateRole = (userId: string, newRole: "admin" | "member" | "guest") => {
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
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Membres</h1>
          <p className="text-muted-foreground">Gérez les membres de {currentOrganization.name}</p>
        </div>
        {canManageMembers && (
          <Button onClick={() => setIsInviteDialogOpen(true)}>
            <UserPlus className="mr-2 size-4" />
            Inviter un membre
          </Button>
        )}
      </div>

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
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
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
                                <Button variant="ghost" size="icon" className="size-8">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {member.role === "guest" && (
                                  <DropdownMenuItem
                                    onClick={() => handleUpdateRole(member.user_id, "member")}
                                  >
                                    <User className="mr-2 size-4" />
                                    Promouvoir membre
                                  </DropdownMenuItem>
                                )}
                                {member.role === "member" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => handleUpdateRole(member.user_id, "admin")}
                                    >
                                      <Shield className="mr-2 size-4" />
                                      Promouvoir admin
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleUpdateRole(member.user_id, "guest")}
                                    >
                                      <Eye className="mr-2 size-4" />
                                      Rétrograder invité
                                    </DropdownMenuItem>
                                  </>
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
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
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
              <Select
                value={inviteRole}
                onValueChange={(value) => setInviteRole(value as "admin" | "member" | "guest")}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    <div className="flex items-center gap-2">
                      <User className="size-4" />
                      Membre
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="size-4" />
                      Administrateur
                    </div>
                  </SelectItem>
                  <SelectItem value="guest">
                    <div className="flex items-center gap-2">
                      <Eye className="size-4" />
                      Invité
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {inviteRole === "guest"
                  ? "Accès restreint : peut voir Techniciens, Stock, Flux de stock et faire des restocks/sorties. Pas d'accès au Dashboard ni aux paramètres."
                  : inviteRole === "admin"
                    ? "Les administrateurs peuvent inviter et gérer les membres."
                    : "Accès standard : peut voir et gérer le stock, les produits, les techniciens."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsInviteDialogOpen(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button onClick={handleInvite} disabled={isSubmitting || !inviteEmail.trim()}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Envoyer l'invitation
            </Button>
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
