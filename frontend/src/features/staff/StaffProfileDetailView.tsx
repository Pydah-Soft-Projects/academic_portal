"use client";

import { useRouter } from "next/navigation";
import { StaffProfileModal } from "./StaffProfileModal";

type Props = {
  identifier: string;
  initialDate?: string;
};

export function StaffProfileDetailView({ identifier, initialDate }: Props) {
  const router = useRouter();

  return (
    <StaffProfileModal
      identifier={identifier}
      isOpen={true}
      onClose={() => {
        router.push(initialDate ? `/staff?date=${initialDate}` : "/staff");
      }}
      selectedDate={initialDate}
    />
  );
}
