import { Toaster } from "@/components/ui/sonner";

export default function AssessmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
