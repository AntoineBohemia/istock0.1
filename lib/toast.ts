import { toast } from "sonner";

// Wrap error/warning with longer default duration (8s instead of 4s)
const _error = toast.error;
const _warning = toast.warning;

toast.error = ((message: Parameters<typeof _error>[0], data?: Parameters<typeof _error>[1]) =>
  _error(message, { duration: 8000, ...data })) as typeof toast.error;

toast.warning = ((message: Parameters<typeof _warning>[0], data?: Parameters<typeof _warning>[1]) =>
  _warning(message, { duration: 8000, ...data })) as typeof toast.warning;

export { toast };
