import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <RouterProvider router={router} />
    </>
  );
}
