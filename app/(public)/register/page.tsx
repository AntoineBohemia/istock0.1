"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const registerSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Page() {
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const supabase = createClient();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (data: RegisterFormValues) => {
    setError(null);

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
        },
      },
    });

    if (error) {
      setError(error.message);
      return;
    }

    setIsSuccess(true);
  };

  if (isSuccess) {
    return (
      <div className="relative flex items-center justify-center min-h-screen py-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="mx-auto w-96">
          <CardHeader>
            <CardTitle className="text-2xl">Vérifiez vos emails</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-4">
              Nous vous avons envoyé un email de confirmation. Veuillez vérifier votre boîte de réception et cliquer sur le lien pour activer votre compte.
            </p>
            <Link href="/login">
              <Button className="w-full">Retour à la connexion</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen py-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="mx-auto w-96">
        <CardHeader>
          <CardTitle className="text-2xl">Créer un compte</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4">
                {error && (
                  <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                    {error}
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="first_name">Prénom</Label>
                      <FormControl>
                        <Input
                          {...field}
                          id="first_name"
                          placeholder="Prénom"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="last_name">Nom</Label>
                      <FormControl>
                        <Input
                          {...field}
                          id="last_name"
                          placeholder="Nom"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="email">Email</Label>
                      <FormControl>
                        <Input
                          {...field}
                          id="email"
                          type="email"
                          placeholder="contact@exemple.com"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="password">Mot de passe</Label>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            id="password"
                            type={showPassword ? "text" : "password"}
                            disabled={isLoading}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création en cours...
                    </>
                  ) : (
                    "Créer mon compte"
                  )}
                </Button>
              </div>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Déjà un compte ?{" "}
            <Link href="/login" className="underline">
              Se connecter
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
