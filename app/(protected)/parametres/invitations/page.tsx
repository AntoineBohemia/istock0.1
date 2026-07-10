"use client";

import React from "react";
import {
  Building2,
  Check,
  Clock,
  Loader2,
  Mail,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getMyPendingInvitations,
  acceptInvitation,
} from "@/lib/supabase/queries/organizations";
import { queryKeys } from "@/lib/query-keys";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { getUserOrganizations } from "@/lib/supabase/queries/organizations";

export default function MyInvitationsPage() {
  const queryClient = useQueryClient();
  const { setOrganizations, setCurrentOrganization, currentOrganization } =
    useOrganizationStore();

  const {
    data: invitations = [],
    isLoading,
  } = useQuery({
    queryKey: queryKeys.organizations.myInvitations(),
    queryFn: getMyPendingInvitations,
  });

  const acceptMutation = useMutation({
    mutationFn: (token: string) => acceptInvitation(token),
    onSuccess: async (result) => {
      toast.success(`Vous avez rejoint ${result.organization.name}`);
      // Recharger les organisations dans le store
      const orgs = await getUserOrganizations();
      setOrganizations(orgs);
      if (!currentOrganization) {
        setCurrentOrganization(orgs[0]);
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.myInvitations(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.list(),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Mes invitations
        </h2>
        <p className="text-muted-foreground">
          Invitations en attente pour rejoindre des organisations
        </p>
      </div>

      {invitations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="size-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-sm">
              Aucune invitation en attente
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invitations.map((invitation) => {
            const org = Array.isArray(invitation.organization)
              ? invitation.organization[0]
              : invitation.organization;
            const orgName = org?.name || "Organisation";
            const orgLogo = org?.logo_url || null;
            const expiresAt = invitation.expires_at
              ? new Date(invitation.expires_at)
              : null;
            const daysLeft = expiresAt
              ? Math.ceil(
                  (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )
              : null;

            return (
              <Card key={invitation.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10">
                        {orgLogo && <AvatarImage src={orgLogo} />}
                        <AvatarFallback>
                          <Building2 className="size-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">
                          {orgName}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {invitation.role === "admin"
                              ? "Administrateur"
                              : "Membre"}
                          </Badge>
                          {daysLeft !== null && (
                            <span className="flex items-center gap-1 text-xs">
                              <Clock className="size-3" />
                              Expire dans {daysLeft}j
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => acceptMutation.mutate(invitation.token)}
                      disabled={acceptMutation.isPending}
                    >
                      {acceptMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin mr-1" />
                      ) : (
                        <Check className="size-4 mr-1" />
                      )}
                      Accepter
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
