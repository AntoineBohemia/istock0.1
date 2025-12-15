import React from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CardsOverview = () => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>Etat du stock</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">
            85.000
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <span className="text-green-600">+5.02</span>
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Flux de la période</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">
            + €2,300
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <span className="text-green-600">+20.1%</span>
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Entrées</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">
            €4,530
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <span className="text-green-600">+3.1%</span>
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Sorties</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">
            €2,230
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <span className="text-red-600">-3.58%</span>
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>
    </div>
  );
};

export default CardsOverview;
