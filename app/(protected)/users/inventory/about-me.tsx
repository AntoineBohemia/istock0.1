"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AboutMe() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>About Me</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>
          Hi I&#39;m Anna Adam, It will be as simple as Occidental; in fact, it will be Occidental.
          To an English person, it will seem like simplified English, as a skeptical Cambridge
          friend of mine told me what Occidental is European languages are members of the same
          family.
        </p>
        <p>
          You always want to make sure that your fonts work well together and try to limit the
          number of fonts you use to three or less. Experiment and play around with the fonts that
          you already have in the software you’re working with reputable font websites. This may be
          the most commonly encountered tip I received from the designers I spoke with. They highly
          encourage that you use different fonts in one design, but do not over-exaggerate and go
          overboard.
        </p>
      </CardContent>
    </Card>
  );
}
