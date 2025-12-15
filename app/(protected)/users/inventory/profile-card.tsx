"use client";

import * as React from "react";
import { Link2Icon, Mail, MapPin, PhoneCall } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function ProfileCard() {
  return (
    <Card className="relative">
      <CardContent>
        <div className="space-y-12">
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="size-20">
              <AvatarImage
                src={`${process.env.ASSETS_URL}/avatars/10.png`}
                alt="@shadcn"
              />
              <AvatarFallback>AH</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h5 className="text-xl font-semibold">Stern Thireau</h5>
              <div className="text-muted-foreground text-sm">Peintre</div>
            </div>
          </div>
          <div className="bg-muted grid grid-cols-3 divide-x rounded-md border text-center *:py-3">
            <div>
              <h5 className="text-lg font-semibold">6 jours</h5>
              <div className="text-muted-foreground text-sm">Derier réapp.</div>
            </div>
            <div>
              <h5 className="text-lg font-semibold">32</h5>
              <div className="text-muted-foreground text-sm">YYY</div>
            </div>
            <div>
              <h5 className="text-lg font-semibold">4.5K</h5>
              <div className="text-muted-foreground text-sm">YYY</div>
            </div>
          </div>
          <div className="flex flex-col gap-y-4">
            <div className="flex items-center gap-3">
              <Mail className="text-muted-foreground size-4" />{" "}
              stern.thireau@gmail.com
            </div>
            <div className="flex items-center gap-3">
              <PhoneCall className="text-muted-foreground size-4" /> (+33) 6 25
              87 25 55
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="text-muted-foreground size-4" />
              Melun
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
