import { Suspense } from "react";
import InvitationApplicationForm from "./InvitationApplicationForm";

type InvitationPageProps = {
  searchParams: Promise<{ token?: string }>;
};

async function InvitationPageContent({ searchParams }: InvitationPageProps) {
  const params = await searchParams;
  return <InvitationApplicationForm token={params.token ?? ""} />;
}

export default function InvitationApplicationPage(props: InvitationPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-6 text-sm text-slate-500">
          Preparando el formulario de invitación...
        </main>
      }
    >
      <InvitationPageContent searchParams={props.searchParams} />
    </Suspense>
  );
}
