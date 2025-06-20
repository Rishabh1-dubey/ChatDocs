import { useState } from "react";
import Dropzone from "react-dropzone";
import { Cloud, File, Loader2 } from "lucide-react";
import { Progress } from "./ui/progress";
import { useUploadThing } from "@/lib/uploadthing";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/app/_trpc/client";
import { useRouter } from "next/navigation";

const UploadDropzone = ({
  isSubscribed,
}: {
  isSubscribed: boolean
}) => {
  const router = useRouter();
  const [isUploading, setIsuploading] = useState<boolean>(true);

  const [UploadProgress, setUploadProgress] = useState<number>(0);

  const { toast } = useToast();

  const { startUpload } = useUploadThing(
    isSubscribed ? 'proPlanUploader' : 'freePlanUploader'
  )

  const { mutate: startPolling } = trpc.getFile.useMutation({
    onSuccess: (file) => {
      router.push(`/dashboard/${file.id}`);
    },
    retry: true,
    retryDelay: 500,
  });

  const startSimulatedProgress = () => {
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prevProgress) => {
        if (prevProgress >= 95) {
          clearInterval(interval);
          return prevProgress;
        }
        return prevProgress + 5;
      });
    }, 500);
    return interval;
  };

  return (
    <Dropzone
      multiple={false}
      onDrop={async (acceptedFile) => {
        // console.log(acceptedFile);
        setIsuploading(true);

        const progressInterval = startSimulatedProgress();
        console.log("starting upload sucess .....");

        //handle file uploading
        const res = await startUpload(acceptedFile);

        // console.log("Just checking the Res content", res);
        if (!res) {
          return toast({
            title: "Something went wrong",
            description: "Please try again later",
            variant: "destructive",
          });
        }

        const [fileResponse] = res;
        const key = fileResponse?.key;

        if (!key) {
          return toast({
            title: "Something went wrong",
            description: "Please try again later",
            variant: "destructive",
          });
        }

        // await new Promise((resolve) => setTimeout(resolve, 10000));

        clearInterval(progressInterval);
        setUploadProgress(100);

        startPolling({ key });
      }}
    >
      {({ getRootProps, getInputProps, acceptedFiles }) => (
        <div
          {...getRootProps()}
          className="border h-64 m-4 border-dashed border-gray-300 rounded-lg"
        >
          <div className="flex items-center justify-center h-full w-full">
            <label
              htmlFor="dropzone-file"
              className="flex flex-col items-center justify-center w-full h-full rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Cloud className="h-6 w-6 text-zinc-600 mb-2" />
                <p className="mb-2 text-sm text-zinc-700">
                  <span className="font-semibold"> Click to Upload </span> or
                  Drag and Drop
                </p>
                <p className="text-xs text-zinc-500"> PDF (up to {isSubscribed ? "16" : "6"}MB) </p>
              </div>

              {acceptedFiles && acceptedFiles[0] ? (
                <div className="max-w-xs bg-white flex items-center rounded-md overflow-hidden outline outline-[1px] outline-zinc-200 divide-x divide-zinc-200">
                  <div className="px-3  py-2 h-full grid place-items-center">
                    <File className=" h-2 w-4 text-blue-500" />
                  </div>
                  <div className="px-3 py-2 h-full text-sm truncate">
                    {acceptedFiles[0].name}
                  </div>
                </div>
              ) : null}

              {isUploading ? (
                <div className="w-full mt-5 max-w-xs mx-auto">
                  <Progress indicatorColor={UploadProgress ===100 ? 'bg-green-500' : ''}
                    value={UploadProgress}
                    className="h-1 w-full bg-zinc-200"
                  /> 
                  {UploadProgress === 100 ? (
                    <div className="flex gap-1 items-center justify-center text-sm text-zinc-700">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Redirecting....
                    </div>
                  ) : null}
                </div>
              ) : null}

              <input
                {...getInputProps()}
                type="file"
                id="dropzone-file"
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}
    </Dropzone>
  );
};

export default UploadDropzone;
