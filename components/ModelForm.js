import { None, noop } from "@/utils/none";
import { Typography } from "@mui/material";
import Form, { FormErrors, FormSubmit } from "./Form";
import { createContext, useContext, useEffect, useId, useRef } from "react";
import Spacer from "./Spacer";
import { uploadFile } from "@/logic/storage";
import { timeFormat } from "d3";
import hasProp from "@/utils/hasProp";
import { mountStore } from "@/models/lib/item_store";
import { useUpdate } from "react-use";
import { ModelFormField } from "./ModelFormField";
import { getDefaultValue } from "@/models/lib/model_type_info";
import pick from "@/utils/pick";
import { checkError } from "@/models/lib/errors";
import { FirestoreError } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { singular } from "@/utils/plural";
import sentenceCase from "@/utils/sentenceCase";
const FORM_SECTION = "!modelform-section";

const ItemStoreContext = createContext();

export const useOnCreateItem = () => useContext(ItemStoreContext);
/* Make this component simple enough for most use cases, advanced cases should just use ModelFormField */
export default function ModelForm({
  model,
  meta = model.Meta,
  item,
  submitText,
  onSubmit = noop,
  //Used when creating an Item whose Model uses EXACT_IDS and also when deferring item creation like in RefField
  noSave = false,
  disabled = !item && !noSave,
  children,
  ...props
}) {
  const sections = { DEFAULT: [] };
  Object.keys(meta).forEach((e) => {
    let section = sections.DEFAULT;
    const sectionName = meta[e][FORM_SECTION];
    if (sectionName) {
      section = sections[sectionName] || (sections[sectionName] = []);
    }
    if (e[0] === "!") return;
    section.push(e);
  });

  const itemStore = useRef();
  if (!itemStore.current) itemStore.current = mountStore();
  const outerStore = useContext(ItemStoreContext);
  const update = useUpdate();
  useEffect(() => {
    if (!itemStore.current) {
      itemStore.current = mountStore();
      update();
    }
    return () => {
      itemStore.current.unmount();
      itemStore.current = null;
    };
  }, [update]);

  return (
    <ItemStoreContext.Provider
      value={noSave && outerStore ? outerStore : itemStore.current.keep}
    >
      <Form
        key={item?.id?.() ?? ""}
        onSubmit={async (data) => {
          try {
            data = await prepareForUpload(data, meta);
            if (!noSave) await item.set(data);
            await onSubmit(data);
          } catch (e) {
            checkError(e, FirebaseError);
            console.error(e);
            throw new Error(
              e.code === "not-found"
                ? "Server Error: One or more documents have been deleted since this operation started."
                : "Unknown Server Error"
            );
          }
        }}
        initialValue={item ? prepareForRender(item.data(), meta) : None}
        {...props}
      >
        {children ? (
          children
        ) : (
          <>
            <div className="flex flex-wrap justify-between -mx-4">
              <Typography
                variant="body2"
                color="text.disabled"
                className="text-right w-full"
              >
                {item ? item.id() : noSave ? "" : "Loading..."}
              </Typography>
              <FormErrors />
              {Object.keys(sections)
                .map((e) => [
                  e === "DEFAULT" ? null : (
                    <Typography
                      key={"!header-" + e}
                      variant="h5"
                      sx={{ mt: 15 }}
                    >
                      {e}
                    </Typography>
                  ),
                  sections[e].map((e) =>
                    meta[e].hidden ? null : (
                      <ModelFormField
                        key={e}
                        name={e}
                        meta={meta[e]}
                        disabled={disabled}
                      />
                    )
                  ),
                  <div key={"!spacer" + e} className="w-full" />,
                ])
                .flat()}
            </div>
            <Spacer />
            <FormSubmit
              sx={{ mt: 12, display: "block", ml: "auto" }}
              variant="contained"
              size="large"
              disabled={disabled}
            >
              {submitText ?? (item?.isLocalOnly?.() ? "Save" : "Update")}
            </FormSubmit>
          </>
        )}
      </Form>
    </ItemStoreContext.Provider>
  );
}

/**
 *
 * @param {any} data
 * @param {import("@/models/lib/model_type_info").ModelTypeInfo} meta
 */
const prepareForUpload = async (data, meta) => {
  data = Object.assign(
    {},
    pick(
      data,
      Object.keys(data).filter((e) => data[e] !== undefined)
    )
  );
  for (let key in meta) {
    if (hasProp(data, key)) {
      if (!meta[key]) console.warn("Missing meta for " + key);
      switch (meta[key].type) {
        case "datetime":
        case "date":
        case "time":
          data[key] = data[key]
            ? new Date(String(data[key]))
            : getDefaultValue(meta[key]);
          break;
        case "file":
        case "image":
          if (data[key] && typeof data[key] !== "string") {
            data[key] = await uploadFile(data[key]);
          } else if (!data[key]) data[key] = getDefaultValue(meta[key]);
          break;
        case "number":
          data[key] = Number(data[key]) || 0;
          break;
        case "array":
          data[key] = await Promise.all(
            data[key]?.map?.(
              async (e) =>
                (
                  await prepareForUpload(
                    { value: e },
                    { value: meta[key].arrayType }
                  )
                ).value
            )
          );
          break;
        case "object":
          data[key] = await prepareForUpload(data[key], meta[key].objectType);
          break;
      }
    }
  }
  return data;
};

const DATE = timeFormat("%Y-%m-%d");
const DATE_TIME = timeFormat("%Y-%m-%dT%H:%M");
const TIME = timeFormat("%H:%M");
/**
 *
 * @param {any} data
 * @param {import("@/models/lib/model_type_info").ModelTypeInfo} meta
 */
const prepareForRender = (data, meta) => {
  data = Object.assign({}, data);
  for (let key in meta) {
    if (hasProp(data, key) && data[key]) {
      switch (meta[key].type) {
        case "datetime":
          data[key] = DATE_TIME(data[key]);
          break;
        case "date":
          data[key] = DATE(data[key]);
          break;
        case "time":
          data[key] = TIME(data[key]);
          break;
        case "array":
          data[key] = data[key]?.map?.(
            (e) =>
              prepareForRender({ value: e }, { value: meta[key].arrayType })
                .value
          );
          break;
        case "object":
          data[key] = prepareForRender(data[key], meta[key].objectType);
          break;
      }
    }
  }
  return data;
};
