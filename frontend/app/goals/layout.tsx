export const metadata = {
  title: "Goal Management - Nestera",
};

export default function GoalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#061218]">
      {children}
    </div>
  );
}
