"use client";

import React from "react";
import { CommandIcon, SearchIcon, icons, Package, Users, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { page_routes } from "@/lib/routes-config";
import { useEffect, useRef, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useTechnicians } from "@/hooks/queries";

type CommandItemProps = {
  item: {
    title: string;
    href: string;
    icon?: string;
  };
};

export default function Search() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setQuery("");
      setDebouncedQuery("");
    }
  };

  const { data: productsResult, isLoading: productsLoading } = useProducts({
    organizationId: orgId,
    search: debouncedQuery || undefined,
    page: 1,
    pageSize: 5,
  });

  const { data: technicians } = useTechnicians(open ? orgId : undefined);

  const showProducts = debouncedQuery.length >= 2;

  const CommandItemComponent: React.FC<CommandItemProps> = ({ item }) => {
    // @ts-expect-error
    const LucideIcon = icons[item.icon];

    return (
      <CommandItem
        onSelect={() => {
          handleOpenChange(false);
          router.push(item.href);
        }}
      >
        {item.icon && <LucideIcon className="me-2 h-4! w-4!" />}
        <span>{item.title}</span>
      </CommandItem>
    );
  };

  return (
    <div className="ms-auto lg:me-auto lg:flex-1">
      <div className="relative hidden max-w-sm flex-1 lg:block">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          className="h-9 w-full cursor-pointer rounded-md border pr-4 pl-10 text-sm shadow-xs"
          placeholder="Recherchez..."
          type="search"
          onFocus={() => setOpen(true)}
        />
        <div className="absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-0.5 rounded-sm bg-zinc-200 p-1 font-mono text-xs font-medium sm:flex dark:bg-neutral-700">
          <CommandIcon className="size-3" />
          <span>k</span>
        </div>
      </div>
      <div className="block lg:hidden">
        <Button size="icon" variant="outline" onClick={() => setOpen(true)}>
          <SearchIcon />
        </Button>
      </div>
      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <VisuallyHidden>
          <DialogHeader>
            <DialogTitle></DialogTitle>
          </DialogHeader>
        </VisuallyHidden>
        <CommandInput
          placeholder="Rechercher un produit, technicien ou page..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>

          {showProducts && (
            <CommandGroup heading="Produits">
              {productsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                </div>
              ) : productsResult?.products.length ? (
                productsResult.products.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={`${product.name} ${product.sku ?? ""}`}
                    onSelect={() => {
                      handleOpenChange(false);
                      router.push(`/product/${product.id}`);
                    }}
                  >
                    <Package className="me-2 h-4 w-4 shrink-0" />
                    <span>{product.name}</span>
                    {product.sku && (
                      <span className="text-muted-foreground ml-auto text-xs">
                        {product.sku}
                      </span>
                    )}
                  </CommandItem>
                ))
              ) : (
                <div className="text-muted-foreground py-2 text-center text-sm">
                  Aucun produit trouvé
                </div>
              )}
            </CommandGroup>
          )}

          {technicians?.length ? (
            <CommandGroup heading="Techniciens">
              {technicians.map((tech) => (
                <CommandItem
                  key={tech.id}
                  value={`${tech.first_name} ${tech.last_name} ${tech.email ?? ""}`}
                  onSelect={() => {
                    handleOpenChange(false);
                    router.push(`/users/${tech.id}`);
                  }}
                >
                  <Users className="me-2 h-4 w-4 shrink-0" />
                  <span>
                    {tech.first_name} {tech.last_name}
                  </span>
                  {tech.city && (
                    <span className="text-muted-foreground ml-auto text-xs">
                      {tech.city}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {page_routes.map((route) => (
            <React.Fragment key={route.title}>
              <CommandGroup heading={route.title}>
                {route.items.map((item, key) => (
                  <CommandItemComponent key={key} item={item} />
                ))}
              </CommandGroup>
              <CommandSeparator />
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
