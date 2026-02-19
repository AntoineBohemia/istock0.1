"use client";

import React, { useEffect, useState } from "react";
import {
  Crown,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Shield,
  Trash2,
  User,
  UserMinus,
  UserPlus,
  Clock,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import {
  OrganizationMember,
  OrganizationInvitation,
} from "@/lib/supabase/queries/organizations";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationMembers, usePendingInvitations } from "@/hooks/queries";
import { useUpdateMemberRole, useRemoveMember, useInviteUser, useCancelInvitation } from "@/hooks/mutations";

type MemberWithEmail = OrganizationMember;

const roleLabels: Record<string, { label: string; icon: React.ElementType }> = {
  owner: { label: "Propriétaire", icon: Crown },
  admin: { label: "Administrateur", icon: Shield },
  member: { label: "Membre", icon: User },
};

export default function MembersPage() {
  const { currentOrganization } = useOrganizationStore();
  const { data: members = [], isLoading: isLoadingMembers } = useOrganizationMembers(currentOrganization?.id);

  const canManageMembers =
    currentOrganization?.role === "owner" ||
    currentOrganization?.role === "admin";

  const { data: invitations = [], isLoading: isLoadingInvitations } = usePendingInvitations(
    canManageMembers ? currentOrganization?.id : undefined
  );

  const updateRoleMutation = useUpdateMemberRole();
  const removeMemberMutation = useRemoveMember();
  const inviteUserMutation = useInviteUser();
  const cancelInvitationMutation = useCancelInvitation();

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [memberToRemove, setMemberToRemove] = useState<MemberWithEmail | null>(null);

  const isLoading = isLoadingMembers || isLoadingInvitations;
  const isSubmitting = removeMemberMutation.isPending || inviteUserMutation.isPending;

  // Get current user ID
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
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
        onSuccess: () => {
          toast.success(`Invitation envoyée à ${inviteEmail}`);
          setIsInviteDialogOpen(false);
          setInviteEmail("");
          setInviteRole("member");
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Erreur lors de l'invitation"
          );
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
          toast.error(
            error instanceof Error ? error.message : "Erreur lors de la mise à jour"
          );
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
          toast.error(
            error instanceof Error ? error.message : "Erreur lors du retrait"
          );
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
          toast.error(
            error instanceof Error ? error.message : "Erreur lors de l'annulation"
          );
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
          <p className="text-muted-foreground">
            Gérez les membres de {currentOrganization.name}
          </p>
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
          <CardTitle>Membres de l'équipe</CardTitle>
          <CardDescription>
            {members.length} membre(s) dans cette organisation
          </CardDescription>
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
              {members.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManageMembers ? 4 : 3}
                    className="h-24 text-center"
                  >
                    <div className="text-muted-foreground">
                      Aucun membre trouvé
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => {
                  const RoleIcon = roleLabels[member.role ?? ""]?.icon || User;
                  const isCurrentUser = member.user_id === currentUserId;
                  const isOwner = member.role === "owner";

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs">
                              {member.user_id.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {member.user?.email || "Utilisateur"}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (vous)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {member.user_id.substring(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isOwner ? "default" : "secondary"}
                          className="gap-1"
                        >
                          <RoleIcon className="size-3" />
                          {roleLabels[member.role ?? ""]?.label || member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(member.created_at ?? Date.now()).toLocaleDateString(
                            "fr-FR"
                          )}
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
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {member.role === "member" ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleUpdateRole(member.user_id, "admin")
                                    }
                                  >
                                    <Shield className="mr-2 size-4" />
                                    Promouvoir admin
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleUpdateRole(member.user_id, "member")
                                    }
                                  >
                                    <User className="mr-2 size-4" />
                                    Rétrograder membre
                                  </DropdownMenuItem>
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
                        {new Date(invitation.expires_at ?? Date.now()).toLocaleDateString(
                          "fr-FR"
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => handleCancelInvitation(invitation.id)}
                      >
                        <X className="size-4" />
                      </Button>
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
              Envoyez une invitation par email pour rejoindre{" "}
              {currentOrganization.name}
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
                onValueChange={(value: "admin" | "member") =>
                  setInviteRole(value)
                }
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
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Les administrateurs peuvent inviter et gérer les membres.
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
            <Button
              onClick={handleInvite}
              disabled={isSubmitting || !inviteEmail.trim()}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Envoyer l'invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer ce membre</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir retirer ce membre de l'organisation ? Il
              perdra l'accès à toutes les données de {currentOrganization.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Annuler
            </AlertDialogCancel>
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
