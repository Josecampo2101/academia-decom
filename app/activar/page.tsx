import { Suspense } from "react";
import InvitationActivationForm from "./InvitationActivationForm";

type ActivationPageProps = {
  searchParams: Promise<{ request_id?: string }>;
};

async function ActivationPageContent({ searchParams }: ActivationPageProps) {
  const params = await searchParams;
  return <InvitationActivationForm requestId={params.request_id ?? ""} />;
}

export default function InvitationActivationPage(props: ActivationPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-6 text-sm text-slate-500">
          Preparando la activación de tu cuenta...
        </main>
      }
    >
      <ActivationPageContent searchParams={props.searchParams} />
    </Suspense>
  );
}
