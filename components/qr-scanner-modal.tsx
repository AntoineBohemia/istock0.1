"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, AlertCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (productId: string) => void;
}

const QR_PATTERN = /^smpr:\/\/product\/(.+)$/;

export default function QrScannerModal({
  open,
  onClose,
  onScan,
}: QrScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    setError(null);
    setIsStarting(true);

    const startScanner = async () => {
      try {
        // Wait for DOM to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!mounted || !containerRef.current) return;

        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // QR code scanned successfully
            const match = decodedText.match(QR_PATTERN);

            if (match) {
              const productId = match[1];
              handleStop();
              onScan(productId);
              onClose();
            } else {
              setError(
                `Format QR invalide. Attendu: smpr://product/{id}\nReçu: ${decodedText}`
              );
            }
          },
          () => {
            // QR code scan error (no QR found in frame) - ignore
          }
        );

        if (mounted) {
          setIsStarting(false);
        }
      } catch (err) {
        if (!mounted) return;

        setIsStarting(false);

        if (err instanceof Error) {
          if (
            err.message.includes("Permission") ||
            err.message.includes("NotAllowedError")
          ) {
            setError(
              "Accès à la caméra refusé. Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur."
            );
          } else if (err.message.includes("NotFoundError")) {
            setError("Aucune caméra détectée sur cet appareil.");
          } else {
            setError(`Erreur: ${err.message}`);
          }
        } else {
          setError("Une erreur inattendue s'est produite.");
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      handleStop();
    };
  }, [open]);

  const handleStop = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          // Html5QrcodeScannerState.SCANNING
          await scannerRef.current.stop();
        }
      } catch {
        // Ignore stop errors
      }
      scannerRef.current = null;
    }
  };

  const handleClose = () => {
    handleStop();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5" />
            Scanner un QR Code
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={handleClose}
          >
            <X className="size-4" />
            <span className="sr-only">Fermer</span>
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="whitespace-pre-wrap">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg bg-black"
          >
            <div
              id="qr-reader"
              className="w-full"
              style={{ minHeight: "300px" }}
            />

            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center text-white">
                  <Camera className="mx-auto size-8 animate-pulse" />
                  <p className="mt-2 text-sm">Démarrage de la caméra...</p>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Placez le QR code du produit dans le cadre
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
