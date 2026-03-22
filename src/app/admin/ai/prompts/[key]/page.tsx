import React from "react";
import AdminAiPromptEditPage from "@/features/admin/components/ai/AdminAiPromptEditPage";

type Props = { params: Promise<{ key: string }> };

export default async function AdminAiPromptEditRoute({ params }: Props) {
  const { key } = await params;
  return <AdminAiPromptEditPage promptKey={key} />;
}
