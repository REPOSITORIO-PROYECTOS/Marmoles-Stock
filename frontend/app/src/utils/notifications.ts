import { toast } from 'sonner';

export const notifySuccess = (message: string) => {
  toast.success(message);
};

export const notifyError = (message: string) => {
  toast.error(message);
};

export const notifyInfo = (message: string) => {
  toast(message);
};

export const notifyPromise = <T>(p: Promise<T>, messages: { loading?: string; success?: string; error?: string }) => {
  const { loading = 'Procesando...', success = 'Completado', error = 'Error' } = messages || {};
  return toast.promise(p, { loading, success, error });
};
