"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Bell, LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

interface UserData {
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

function getInitials(name: string, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  // Fallback to email
  return email.slice(0, 2).toUpperCase();
}

export default function UserMenu() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    async function fetchUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser) {
        setUser({
          email: authUser.email || "",
          fullName: authUser.user_metadata?.full_name ||
                    authUser.user_metadata?.name ||
                    "",
          avatarUrl: authUser.user_metadata?.avatar_url || null,
        });
      }
    }

    fetchUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser({
            email: session.user.email || "",
            fullName: session.user.user_metadata?.full_name ||
                      session.user.user_metadata?.name ||
                      "",
            avatarUrl: session.user.user_metadata?.avatar_url || null,
          });
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const displayName = user?.fullName || user?.email?.split("@")[0] || "Utilisateur";
  const displayEmail = user?.email || "";
  const initials = user ? getInitials(user.fullName, user.email) : "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="cursor-pointer">
          {user?.avatarUrl && (
            <AvatarImage src={user.avatarUrl} alt={displayName} />
          )}
          <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
        align="end"
      >
        <DropdownMenuLabel className="p-0">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar>
              {user?.avatarUrl && (
                <AvatarImage src={user.avatarUrl} alt={displayName} />
              )}
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{displayName}</span>
              <span className="text-muted-foreground truncate text-xs">
                {displayEmail}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem>
            <BadgeCheck />
            Mon Compte
          </DropdownMenuItem>

          <DropdownMenuItem>
            <Bell />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          <LogOut />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
