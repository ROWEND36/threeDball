import { IconButton, Modal, Paper, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import SuccessDialog from "./SuccessDialog";
import { CloseCircle } from "iconsax-react";
import ModelForm from "./ModelForm";
import { noop } from "@/utils/none";

export default function ModelFormDialog({
  isOpen = false,
  edit,
  closeOnSubmit = !edit,
  model: Model,
  title,
  noSave,
  onSubmit,
  onClose = noop,
}) {
  const [item, setItem] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setItem(isOpen ? edit || (noSave ? null : Model.create()) : null);
  }, [edit, isOpen, Model, noSave]);
  return (
    <Modal
      onClose={(e, reason) => {
        if (reason && reason == "backdropClick") return;
        onClose(e);
      }}
      open={isOpen}
      className="p-4"
    >
      {/* Modal must have only one child */}
      <Paper className="h-full w-full mx-auto max-w-2xl pt-4 px-8 max-sm:px-4 overflow-auto pb-12 flex flex-col">
        <SuccessDialog
          open={submitted}
          onClose={() => {
            setSubmitted(false);
            if (closeOnSubmit) onClose();
          }}
        />
        <div className="text-right -mx-3.5 max-sm:-mx-0.5">
          <IconButton onClick={onClose}>
            <CloseCircle />
          </IconButton>
        </div>
        <Typography variant="h4" sx={{ mb: 4 }}>
          {title}
        </Typography>
        <ModelForm
          model={Model}
          item={item}
          className="flex-grow flex flex-col"
          noSave={noSave}
          onSubmit={async (data) => {
            console.log(data);
            await onSubmit?.(data);
            setSubmitted(true);
          }}
        />
      </Paper>
    </Modal>
  );
}
