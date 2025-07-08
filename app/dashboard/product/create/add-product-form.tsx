"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircleIcon,
  ChevronLeft,
  CirclePlusIcon,
  ImageIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useFileUpload } from "@/hooks/use-file-upload";
import { AddMediaFromUrl } from "./add-media-from-url";
import AddNewCategory from "./add-category";
import Link from "next/link";

const FormSchema = z.object({
  name: z.string().min(2, {
    message: "Product name must be at least 2 characters.",
  }),
  sku: z.string(),
  barcode: z.string(),
  description: z.string(),
  file: z.string(),
  variants: z.string(),
  price: z.string(),
  status: z.string(),
  category: z.string(),
  sub_category: z.string(),
});

export default function AddProductForm() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      description: "",
    },
  });

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      getInputProps,
    },
  ] = useFileUpload({
    accept: "image/png,image/jpeg,image/jpg",
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: true,
    maxFiles: 5,
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast.success(
      <div>
        <div className="font-semibold mb-2">
          You submitted the following values:
        </div>
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="mb-4 flex items-center justify-between space-y-2">
          <div className="flex items-center gap-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard/product">
                <ChevronLeft />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              Ajouter un produit
            </h1>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary">
              Discard
            </Button>
            <Button type="button" variant="outline">
              Save Draft
            </Button>
            <Button type="submit">Publish</Button>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-4">
          <div className="col-span-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="barcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Barcode</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormDescription>
                          Set a description to the product for better
                          visibility.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
            {/* -- Product images -- */}
            <Card>
              <CardHeader>
                <CardTitle>Product Images</CardTitle>
                <CardAction>
                  <AddMediaFromUrl>
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-0! h-auto p-0"
                    >
                      Add media from URL
                    </Button>
                  </AddMediaFromUrl>
                </CardAction>
              </CardHeader>
              <CardContent>
                <FormField
                  name="file"
                  control={form.control}
                  render={({ field }) => (
                    <div className="flex flex-col gap-2">
                      <div
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        data-dragging={isDragging || undefined}
                        data-files={files.length > 0 || undefined}
                        className="border-input data-[dragging=true]:bg-accent/50 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 relative flex min-h-52 flex-col items-center overflow-hidden rounded-xl border border-dashed p-4 transition-colors not-data-[files]:justify-center has-[input:focus]:ring-[3px]"
                      >
                        <input
                          {...getInputProps()}
                          className="sr-only"
                          aria-label="Upload image file"
                        />
                        {files.length > 0 ? (
                          <div className="flex w-full flex-col gap-3">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="truncate text-sm font-medium">
                                Uploaded Files ({files.length})
                              </h3>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={openFileDialog}
                                disabled={files.length >= 5}
                              >
                                <UploadIcon
                                  className="-ms-0.5 size-3.5 opacity-60"
                                  aria-hidden="true"
                                />
                                Add more
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                              {files.map((file) => (
                                <div
                                  key={file.id}
                                  className="bg-accent relative aspect-square rounded-md border"
                                >
                                  <img
                                    src={file.preview}
                                    alt={file.file.name}
                                    className="size-full rounded-[inherit] object-cover"
                                  />
                                  <Button
                                    type="button"
                                    onClick={() => removeFile(file.id)}
                                    size="icon"
                                    className="border-background focus-visible:border-background absolute -top-2 -right-2 size-6 rounded-full border-2 shadow-none"
                                  >
                                    <XIcon className="size-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
                            <div
                              className="bg-background mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border"
                              aria-hidden="true"
                            >
                              <ImageIcon className="size-4 opacity-60" />
                            </div>
                            <p className="mb-1.5 text-sm font-medium">
                              Drop your images here
                            </p>
                            <p className="text-muted-foreground text-xs">
                              PNG or JPG (max. 5MB)
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              className="mt-4"
                              onClick={openFileDialog}
                            >
                              <UploadIcon
                                className="-ms-1 opacity-60"
                                aria-hidden="true"
                              />
                              Select images
                            </Button>
                          </div>
                        )}
                      </div>

                      {errors.length > 0 && (
                        <div
                          className="text-destructive flex items-center gap-1 text-xs"
                          role="alert"
                        >
                          <AlertCircleIcon className="size-3 shrink-0" />
                          <span>{errors[0]}</span>
                        </div>
                      )}
                    </div>
                  )}
                />
              </CardContent>
            </Card>
            {/* -- Variants -- */}
            <Card className="pb-0">
              <CardHeader>
                <CardTitle>Variants</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  name="variants"
                  control={form.control}
                  render={({ field }) => (
                    <div className="space-y-4">
                      <div className="grid gap-4 lg:grid-flow-col">
                        <FormItem>
                          <FormLabel>Options</FormLabel>
                          <Select {...field}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="size">Size</SelectItem>
                                <SelectItem value="color">Color</SelectItem>
                                <SelectItem value="weight">Weight</SelectItem>
                                <SelectItem value="smell">Smell</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                        <FormItem>
                          <FormLabel>Value</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                        <FormItem>
                          <FormLabel>Price</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      </div>
                      <div className="grid gap-4 lg:grid-flow-col">
                        <FormItem>
                          <Select {...field}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="size">Size</SelectItem>
                                <SelectItem value="color">Color</SelectItem>
                                <SelectItem value="weight">Weight</SelectItem>
                                <SelectItem value="smell">Smell</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                        <FormItem>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                        <FormItem>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      </div>
                    </div>
                  )}
                />
              </CardContent>
              <CardFooter className="justify-center border-t p-0!">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full rounded-none"
                >
                  <CirclePlusIcon /> Add Variant
                </Button>
              </CardFooter>
            </Card>
          </div>
          <div className="col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <FormField
                    name="price"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Price</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="price"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discounted Price</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center space-x-2">
                    <Checkbox id="terms" />
                    <label
                      htmlFor="terms"
                      className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Charge tax on this product
                    </label>
                  </div>
                  <hr />
                  <div className="flex items-center space-x-2">
                    <Switch id="airplane-mode" checked />
                    <Label htmlFor="airplane-mode">In stock</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  name="status"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Select {...field} defaultValue="draft">
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="draft">
                                <span className="size-2 rounded-full bg-orange-400"></span>{" "}
                                Draft
                              </SelectItem>
                              <SelectItem value="active">
                                {" "}
                                <span className="size-2 rounded-full bg-green-400"></span>{" "}
                                Active
                              </SelectItem>
                              <SelectItem value="archived">
                                <span className="size-2 rounded-full bg-indigo-400"></span>{" "}
                                Archived
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>Set the product status.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <FormField
                    name="category"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="flex gap-2">
                            <div className="grow">
                              <Select {...field}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="Electronics">
                                      Electronics
                                    </SelectItem>
                                    <SelectItem value="Clothing">
                                      Clothing
                                    </SelectItem>
                                    <SelectItem value="banana">
                                      Accessories
                                    </SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                            <AddNewCategory />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="sub_category"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="flex gap-2">
                            <div className="grow">
                              <Select {...field}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select a sub category" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="Toys">Toys</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                            <AddNewCategory />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
