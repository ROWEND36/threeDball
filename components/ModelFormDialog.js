import { IconButton, Modal, Paper, Typography } from "@mui/material";
import { useEffect, useId, useState } from "react";
import SuccessDialog from "./SuccessDialog";
import { CloseCircle } from "iconsax-react";
import ModelForm from "./ModelForm";
import { noop } from "@/utils/none";
import useLogger from "@/utils/useLogger";
import FormDialog from "./FormDialog";
import sentenceCase from "@/utils/sentenceCase";
import { singular } from "@/utils/plural";

export default function ModelFormDialog({
  isOpen = false,
  edit,
  closeOnSubmit = !edit,
  model: Model,
  noSave,
  title = (edit ? "Update " : "Add ") +
    sentenceCase(singular(Model.uniqueName())),
  ...props
}) {
  const [item, setItem] = useState(null);

  useEffect(() => {
    setItem(isOpen ? edit || (noSave ? null : Model.create()) : null);
  }, [edit, isOpen, Model, noSave]);
  // const id = useId();

  return (
    <FormDialog
      isOpen={isOpen}
      as={ModelForm}
      model={Model}
      item={item}
      title={title}
      noSave={noSave}
      closeOnSubmit={closeOnSubmit}
      {...props}
    />
  );
}
