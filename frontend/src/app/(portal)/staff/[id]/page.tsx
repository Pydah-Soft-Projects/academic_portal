import { StaffProfileDetailView } from "@/features/staff/StaffProfileDetailView";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
};

export default async function StaffDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { date } = await searchParams;

  return <StaffProfileDetailView identifier={id} initialDate={date} />;
}

