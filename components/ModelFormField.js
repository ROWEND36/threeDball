import { None } from "@/utils/none";
import { FormField, FormImage, FormSelect } from "./Form";
import ModelFormRefField from "./ModelFormRefField";
import ModelFormArrayField from "./ModelFormArrayField";
import { UnimplementedError } from "@/models/lib/errors";

export function ModelFormField({
  name,
  model,
  meta = model.Meta[name],
  disabled,
}) {
  return createFormField(name, meta, { disabled });
}
/** @type {Array<import("@/models/lib/model_type_info").StringType>} */
const INPUT_TYPES = ["email", "password", "tel", "url"];

/** @param {import("@/models/lib/model_type_info").ModelPropInfo} meta*/
function collectInputProps(meta) {
  return Object.keys(meta).reduce((acc, _key) => {
    /** @type {keyof import("@/models/lib/model_type_info").ModelPropInfo}*/
    let key = _key;
    let value = meta[key];
    if (value === undefined) return acc;
    switch (key) {
      // case "label": Handled by commonProps
      // case "required":
      case "minLength":
      case "maxLength":
        break;
      case "pattern":
        value = value.raw;
        break;
      case "minValue":
        key = "min";
        break;
      case "maxValue":
        key = "max";
        break;
      case "type":
        value =
          value === "string"
            ? INPUT_TYPES.includes(meta.stringType)
              ? meta.stringType
              : "text"
            : value === "datetime"
            ? "datetime-local"
            : value === "number"
            ? "text"
            : value;
        break;
      default:
        return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
}

const PATTERNS = {
  date: {
    re: "(\\d{4})-([1-9]|[01][0-2])-([1-9]|[0-3][0-9])",
    desc: "YYYY-MM-DD",
  },
  time: {
    re: "([1-9]|[0-2][0-2]):([1-9]|[1-6][0-9])",
    desc: "HH:MM",
  },
  datetime: {
    re: "(\\d{4})-([1-9]|[01][0-2])-([1-9]|[0-3][0-9])[T ]([1-9]|[0-2][0-2]):([1-9]|[1-6][0-9])",
    desc: "YYYY-MM-DD HH:MM",
  },
};

/**
 *
 * @param {string} name
 * @param {import("@/models/lib/model_type_info").ModelPropInfo} meta
 */
function createFormField(name, meta, { disabled } = {}) {
  const commonProps = {
    name: name,
    key: name,
    label: meta.label,
    disabled: disabled || meta.disabled,
    fullWidth: false,
    required: meta.required,
    sx: {
      minWidth: meta.type === "number" ? "5em" : "15em",
      maxWidth: meta.type === "number" ? "15em" : "none",
      width: meta.type === "number" ? "0" : undefined,
      flexGrow: 1,
      ml: 4,
      mr: 4,
    },
  };
  switch (meta.type) {
    case "string":
    case "number":
      if (meta.options) {
        return (
          <FormSelect
            {...commonProps}
            values={meta.options.map((e) => e.value)}
            labels={meta.options.map((e) => e.label)}
          />
        );
      }
      return (
        <FormField
          {...commonProps}
          fullWidth
          multiline={meta.stringType === "longtext"}
          {...(meta.type === "number"
            ? { inputMode: "numeric", pattern: "[0-9]*" }
            : None)}
          {...collectInputProps(meta)}
          rows={meta.stringType === "longtext" ? 4 : undefined}
        />
      );
    case "boolean":
      return <FormField {...commonProps} type="checkbox" />;
    case "date":
    case "datetime":
    case "time":
      return (
        <FormField
          {...commonProps}
          sx={{ minWidth: "10em", flexGrow: 1, mr: 1, ml: 4, maxWidth: "15em" }}
          pattern={PATTERNS[meta.type].re}
          {...collectInputProps(meta)}
          onInvalid={(e) => {
            if (e.target.validity.patternMismatch)
              e.target.setCustomValidity(
                `Value must match pattern ${PATTERNS[meta.type].desc}`
              );
          }}
        />
      );
    case "image":
      return (
        <FormImage
          {...commonProps}
          sx={{ minWidth: "15em", mr: 1, ml: 4, maxWidth: "30em" }}
        />
      );
    case "ref":
      return (
        <ModelFormRefField
          {...commonProps}
          {...collectInputProps(meta)}
          meta={meta}
        />
      );
    case "array":
      return <ModelFormArrayField name={name} meta={meta} />;
    default:
      throw new UnimplementedError("Unhandled Input type " + meta.type);
  }
}

export default ModelFormField;
