import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const queryString = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      queryString.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((v) => queryString.append(key, v));
    }
  }
  const qs = queryString.toString();
  redirect(qs ? `/login?${qs}` : "/login");
}
