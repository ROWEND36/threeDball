import { UnimplementedError } from "@/models/lib/errors";
import {
  formatDate,
  formatPhoneNumber,
  formatTime,
} from "@/utils/formatNumber";
import { CloseCircle, TickCircle } from "iconsax-react";
import { supplyValue } from "./Table";
import Await from "./Await";
import { Link, Typography } from "@mui/material";
import ModelItemPreview from "./ModelItemPreview";
import { Fragment, memo, useMemo } from "react";
import usePromise from "@/utils/usePromise";
import { guessMeta } from "@/models/lib/model_type_info";
import typeOf from "@/utils/typeof";

/**
 * @param {Object} param0
 * @param {String} param0.name
 * @param {import("@/models/lib/model_type_info").Item} param0.item
 * @param {any} param0.value
 * @param {import("@/models/lib/model_type_info").ModelTypeInfo} param0.meta
 */
function _ModelDataView({
  name,
  item,
  value = item?.[name],
  meta = (item && item.model().Meta[name]) || guessMeta(value),
}) {
  if (!meta) return <i className="error">Error displaying value</i>;
  try {
    switch (meta.type) {
      case "string":
        switch (meta.stringType) {
          case "email":
            return value ? (
              <Link href={"email:" + value}>{value}</Link>
            ) : (
              <NoneProvided />
            );
          case "tel":
            return value ? (
              <Link href={"tel:" + value} className="whitespace-nowrap">
                {formatPhoneNumber(value)}
              </Link>
            ) : (
              <NoneProvided />
            );
          case "url":
            return (
              value && (
                <Link href={value} rel="noopener">
                  {value}
                </Link>
              )
            );
          case "longtext":
            value = value.length > 33 ? value.substring(0, 30) + "..." : value;
            break;
        }
        return value || "-";
      case "number":
        return Number(value).toLocaleString();
      case "boolean":
        return (
          <div className="min-h-full  flex items-center justify-center">
            {value ? <TickCircle color="green" /> : <CloseCircle color="red" />}
          </div>
        );
      case "date":
        return formatDate(value);
      case "datetime":
        return (
          <span className="whitespace-nowrap">
            {formatDate(value) + " " + formatTime(value)}
          </span>
        );
      case "time":
        return formatTime(value);
      case "file":
        return value ? (
          <Link href={value} rel="noopener">
            Download
          </Link>
        ) : (
          <NoneProvided />
        );
      case "ref":
        return value ? (
          <ModelItemPreview item={meta.refModel.item(value)} />
        ) : undefined;
      case "image":
        return value ? (
          <Link href={value} rel="noopener">
            View
          </Link>
        ) : (
          <NoneProvided />
        );
      case "array":
        return (
          <div className="flex flex-wrap" style={{ maxWidth: "20rem" }}>
            {value.map((e, i, a) => (
              <Fragment key={"" + i}>
                <ModelDataView value={e} meta={meta.arrayType} />
                {a[i + 1] ? ", " : ""}
              </Fragment>
            ))}
          </div>
        );
      case "object":
      case "map":
        throw new UnimplementedError(
          "Unimplemented type = " + meta.type + " for ModelDataView"
        );
    }
  } catch (e) {
    console.error(e);
    return null;
  }
}
const _get = (x) => {
  return x && "get" + x[0].toUpperCase() + x.slice(1);
};

const ModelDataView = memo(_ModelDataView, (prev, next) => {
  return (
    prev.item === next.item &&
    prev.name === next.name &&
    ("value" in prev ? prev.value : prev.item?.[prev.name]) ===
      ("value" in next ? next.value : next.item?.[next.name])
  );
});
export default ModelDataView;
const ModelComputedView = memo(function ModelComputedView({ item, prop }) {
  const promise = useMemo(
    () => Promise.resolve(item[_get(prop)]()).catch(console.error),
    [item, prop]
  );
  const value = usePromise(() => promise, [promise]);
  return (
    <Await value={promise}>
      {value === undefined || value === null ? null : (
        <ModelDataView value={value} />
      )}
    </Await>
  );
});
export function supplyModelValues(props) {
  return supplyValue((row, col, items) => {
    if (items?.[row] && typeof items[row] === "object") {
      if (props[col] in items[row]) {
        return <ModelDataView item={items[row]} name={props[col]} />;
      } else if (items?.[row] && _get(props[col]) in items[row]) {
        return <ModelComputedView item={items[row]} prop={props[col]} />;
      }
    }
    return items;
  });
}

function NoneProvided() {
  return (
    <Typography variant="caption" sx={{ display: "block" }}>
      None provided
    </Typography>
  );
}
