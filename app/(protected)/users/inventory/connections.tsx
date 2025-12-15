"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { generateAvatarFallback } from "@/lib/utils";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const connections = [
  {
    name: "Olivia Davis",
    email: "olivia.davis@example.com",
    avatar: `${process.env.ASSETS_URL}/avatars/01.png`,
    status: "connect"
  },
  {
    name: "John Doe",
    email: "john.doe@example.com",
    avatar: `${process.env.ASSETS_URL}/avatars/02.png`,
    status: "disconnect"
  },
  {
    name: "Alice Smith",
    email: "alice.smith@example.com",
    avatar: `${process.env.ASSETS_URL}/avatars/03.png`,
    status: "connect"
  },
  {
    name: "Michael Johnson",
    email: "michael.johnson@example.com",
    avatar: `${process.env.ASSETS_URL}/avatars/04.png`,
    status: "connect"
  },
  {
    name: "Emily Martinez",
    email: "emily.martinez@example.com",
    avatar: `${process.env.ASSETS_URL}/avatars/05.png`,
    status: "disconnect"
  },
  {
    name: "James Wilson",
    email: "james.wilson@example.com",
    avatar: `${process.env.ASSETS_URL}/avatars/06.png`,
    status: "disconnect"
  }
];

export function Connections() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connections</CardTitle>
        <CardAction>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon">
                  <ChevronRight />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View All</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {connections.map((item, key) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={item.avatar} alt="@shadcn" />
                  <AvatarFallback>{generateAvatarFallback(item.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-muted-foreground text-xs">{item.email}</div>
                </div>
              </div>
              {item.status === "disconnect" ? (
                <Button variant="outline" size="sm">
                  Disconnect
                </Button>
              ) : (
                <Button size="sm">Connect</Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
