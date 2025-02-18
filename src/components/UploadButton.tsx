"use client"

import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";

const UploadButton = () => {
  const [isOpen, setisOpen] = useState<boolean>(false);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) {
          setisOpen(v);
        }
      }}
    >
      <DialogTrigger onClick={() => setisOpen(true)} asChild>
        <button className="px-4 py-2 rounded-lg font-semibold bg-blue-700 border-none hover:bg-blue-500 text-white">
          Upload PDF
        </button>
      </DialogTrigger>

      <DialogContent>hello hero log</DialogContent>
    </Dialog>
  );
};

export default UploadButton;
