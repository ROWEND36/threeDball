import { None } from "@/utils/none";
import sentenceCase from "@/utils/sentenceCase";
import { Model } from "./model";
import typeOf from "@/utils/typeof";
import { InvalidParameters } from "./errors";

/**
 * @typedef {import("./query").QueryCursor} QueryCursor
 * @typedef {import("./model").Item} Item
 * @typedef {import("./model").Model} Model
 * @typedef {("string"|"number"|"date"|"datetime"|"time"|"file"|"ref"|"image"|"boolean"|"array"|"map"|"object")} ModelPropType
 * @typedef {("email"|"tel"|"password"|"address"|"text"|"url"|"longtext")} StringType
 *
 * @typedef {{
 *    type: ModelPropType,
 *    required?: boolean,
 *    minLength: number,
 *    maxLength: number,
 *    minValue: number,
 *    maxValue: number,
 *    disabled: boolean,
 *    options?: Array<{value: string, label: string}>,
 *    pattern?: RegexExp,
 *    hidden?: boolean,
 *    stringType?: StringType,
 *    objectType?: ModelTypeInfo,
 *    arrayType?: ModelPropInfo,
 *    mapType?: ModelPropInfo,
 *    pickRefQuery?: true|QueryCursor | String | ()=>AsyncGenerator<Item[], Item[], never>, 
 *    refModel: Model,
 *    label: string,
 *  }} ModelPropInfo

 * @typedef {{
 *  [prop: string]: ModelPropInfo
 * }} ModelTypeInfo
 */
/**
 * @returns {ModelPropType}
 */
function inferType(value, key) {
  const m = typeOf(value);
  switch (m) {
    case "boolean":
    case "number":
    case "string":
    case "object":
    case "array":
      return m;
    case "date":
      return "datetime";
    default:
      throw new InvalidParameters(
        "Failed to infer prop type for " + key + " value: " + value
      );
  }
}
export function guessMeta(value) {
  try {
    return _getModelPropInfo("?", value ?? "", {}, "?");
  } catch (e) {
    return null;
  }
}
/**
 *
 * @param {string} key
 * @param {Item} template
 * @param {Partial<ModelPropInfo>} Meta
 * @param {string} path
 * @returns {ModelPropInfo}
 */
function _getModelPropInfo(key, template, Meta, path) {
  const type = Meta.type || inferType(template, path);
  if (Meta.type === "ref") {
    if (!Meta.refModel || !(Meta.refModel instanceof Model)) {
      if (Meta.refModel !== null)
        throw new InvalidParameters(
          "Invalid or no refModel supplied for " + path
        );
    }
  }
  return {
    ...Meta,
    type,
    required: Meta.required ?? true,
    minLength: Meta.minLength ?? 0,
    maxLength: Meta.maxLength ?? Number.MAX_SAFE_INTEGER,
    minValue: Meta.minValue ?? 0,
    maxValue: Meta.maxLength ?? Number.MAX_SAFE_INTEGER,
    disabled: !!Meta.disabled,
    options: Meta.options
      ? Meta.options.length === 0 || isObject(Meta.options[0])
        ? Meta.options
        : Meta.options.map((e) =>
            isObject(e) ? e : { value: e, label: sentenceCase(String(e)) }
          )
      : undefined,
    pattern: Meta.pattern,
    hidden: !!Meta.hidden,
    stringType: type === "string" ? Meta.stringType ?? "text" : undefined,
    objectType:
      type === "object"
        ? _getModelTypeInfo(template, Meta.objectType, path)
        : undefined,
    arrayType:
      type === "array"
        ? _getModelPropInfo(
            "$i",
            template?.[0] ?? "",
            Meta.arrayType ?? None,
            path + "[]"
          )
        : undefined,
    mapType:
      type === "map"
        ? _getModelTypeInfo(template, Meta.mapType, path + "{}")
        : undefined,
    pickRefQuery: Meta.pickRefQuery ?? "",
    label:
      Meta.label ??
      sentenceCase(key.replace(/Id$/, "").replace(/([a-z])([A-Z])/g, "$1 $2")),
    refModel: Meta.refModel,
  };
}

function isObject(e) {
  return e && typeof e === "object";
}

function _getModelTypeInfo(template, meta, path) {
  const propNames = template ? Object.keys(template) : [];
  if (meta) {
    propNames.push(...Object.keys(meta).filter((e) => !propNames.includes(e)));
  }
  return propNames.reduce((acc, key) => {
    /** @type {Partial<ModelPropInfo>} */
    acc[key] =
      key[0] === "!" || typeof template?.[key] === "function"
        ? meta[key]
        : _getModelPropInfo(
            key,
            template?.[key],
            meta?.[key] || None,
            path + "." + key
          );
    return acc;
  }, {});
}

/**
 *
 * @param {import("./lib/model").Model} Model
 * @returns {ModelTypeInfo}
 */
export default function getModelTypeInfo(Model, meta) {
  return _getModelTypeInfo(Model.item("meta"), meta, Model.uniqueName() + "[]");
}

/**
 *
 * @param {import("@/models/lib/model_type_info").ModelPropInfo} meta
 */
export function getDefaultValue(meta) {
  switch (meta.type) {
    case "string":
    case "file":
    case "image":
    case "ref":
      return "";
    case "number":
      return 0;
    case "date":
    case "datetime":
    case "time":
      return new Date(0);
    case "boolean":
      return false;
    case "object":
      return Object.keys(meta.objectType).map((e) => [
        e,
        getDefaultValue(meta.objectType[e]),
      ]);
    case "array":
      return [];
    case "map":
      return {};
  }
}
