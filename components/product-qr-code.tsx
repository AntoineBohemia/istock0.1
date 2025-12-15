"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProductQRCodeProps {
  productId: string;
  productName: string;
  productSku: string | null;
}

export default function ProductQRCode({
  productId,
  productName,
  productSku,
}: ProductQRCodeProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  const qrValue = `smpr://product/${productId}`;

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `qr-${productSku || productId}.png`;
    link.href = url;
    link.click();
  };

  const handlePrint = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${productName}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 20px;
            }
            .container {
              text-align: center;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
              padding: 24px;
              max-width: 300px;
            }
            .qr-code {
              margin-bottom: 16px;
            }
            .qr-code img {
              width: 150px;
              height: 150px;
            }
            .product-name {
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 4px;
              color: #111827;
            }
            .product-sku {
              font-size: 14px;
              color: #6b7280;
              font-family: monospace;
            }
            @media print {
              body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="qr-code">
              <img src="${dataUrl}" alt="QR Code" />
            </div>
            <p class="product-name">${productName}</p>
            ${productSku ? `<p class="product-sku">${productSku}</p>` : ""}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">QR Code Produit</CardTitle>
        <CardDescription>
          Scannez pour accéder au produit
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <div
            ref={qrRef}
            className="rounded-lg border bg-white p-3"
          >
            <QRCodeCanvas
              value={qrValue}
              size={120}
              level="M"
              marginSize={0}
            />
          </div>

          <div className="text-center">
            <p className="text-sm font-medium">{productName}</p>
            {productSku && (
              <p className="text-xs text-muted-foreground font-mono">
                {productSku}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="size-4" />
              Télécharger
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="size-4" />
              Imprimer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
