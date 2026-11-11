import InvitationActivationForm from "./InvitationActivationForm";

type ActivationPageProps = {
  searchParams: Promise<{ request_id?: string }>;
};

export default async function InvitationActivationPage({
  searchParams,
}: ActivationPageProps) {
  const params = await searchParams;

  return <InvitationActivationForm requestId={params.request_id ?? ""} />;
}
