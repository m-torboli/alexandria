import { Toaster } from "./components/Toaster";
import { useAppStatus } from "./lib/queries";
import { Welcome } from "./features/welcome/Welcome";
import { Workspace } from "./features/workspace/Workspace";

export default function App() {
  const status = useAppStatus();

  return (
    <>
      {status.data && (status.data.library ? <Workspace /> : <Welcome status={status.data} />)}
      {status.error && <p role="alert">{status.error.message}</p>}
      <Toaster />
    </>
  );
}
