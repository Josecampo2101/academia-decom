import InvitationApplicationForm from "./InvitationApplicationForm";

type InvitationPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function InvitationApplicationPage({
  searchParams,
}: InvitationPageProps) {
  const params = await searchParams;

  return <InvitationApplicationForm token={params.token ?? ""} />;
}
