import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { notFound, redirect } from "next/navigation";

import PdfRenderer from '@/components/PdfRenderer';
import ChatWrapper from "@/components/chat/ChatWrapper";

interface PageProps {
  params: Promise<{ fileid: string }>; // Define params as a Promise
}

const Page = async ({ params }: PageProps) => {
  const { fileid } =  await params; // No need to await params

  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (!user || !user.id) redirect(`/auth-callback?origin=dashboard/${fileid}`);

  // Make database call
  const file = await db.file.findFirst({
    where: {
      id: fileid,
      userId: user.id,
    },
  });

  if (!file) notFound();

  return (
    <div className="flex justify-between flex-col h-[calc(100vh-3.5rem)]">
      <div className="mx-auto w-full max-w-8xl grow lg:flex xl:px-2">
        {/* Left side */}
        <div className="flex-1 xl:flex">
          <div className="px-4 py-6 sm:px-6 lg:pl-8 xl:flex-1 xl:pl-6">
            <PdfRenderer url={file.url} />
          </div>
        </div>

        {/* Right side */}
        <div className="shrink-0 flex-[0.75] border-t border-gray-200 lg:w-96 lg:border-l lg:border-t-0">
          <ChatWrapper fileId={file.id} />
        </div>
      </div>
    </div>
  );
};

export default Page;