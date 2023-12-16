import range from "@/utils/range";
import Template from "./Template";
import ThemedButton from "@mui/material/Button";
import mergeProps from "@/utils/mergeProps";
import LoaderAnimation from "./LoaderAnimation";
import {
  createContext,
  isValidElement,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import uniq from "@/utils/uniq";
import { Box, Typography } from "@mui/material";
import { noop } from "@/utils/none";

const borderSpacings = [
  "border-spacing-y-0",
  "border-spacing-y-1",
  "border-spacing-y-2",
  "border-spacing-y-3",
  "border-spacing-y-4",
  "border-spacing-y-5",
];

/**
 *
 * @param {Object} props
 * @param {Array<TableRenderHook>} props.renderHooks
 * @returns
 */
export default function Table({
  data,
  rows = Array.isArray(data) ? data.length : 0,
  cols = Array.isArray(data?.[0]) ? data[0].length : 0,
  tableRef,
  loading = false,
  headers,
  scrollable,
  headerClass = "border-b text-left",
  bodyClass = "leading-relaxed",
  minRows = 0,
  rowProps,
  rowSpacing = 0,
  onClickRow,
  className = "w-full leading",
  renderHooks = [],
}) {
  const [selected, setSelected] = useContext(TableContext);
  const table = (
    <table
      ref={tableRef}
      className={`${className} ${
        rowSpacing > 0 ? "border-separate" : "border-collapse"
      } ${borderSpacings[rowSpacing]}`}
    >
      <thead className={headerClass}>
        <tr>
          {range(cols).map((col) =>
            callHooks(headers, -1, col, [], {}, renderHooks)
          )}
        </tr>
      </thead>
      <tbody className={bodyClass}>
        {loading ? (
          <tr>
            <td colSpan={100} className="w-full py-3">
              <div className="max-w-[95vw]">
                <LoaderAnimation small />
              </div>
            </td>
          </tr>
        ) : rows === 0 ? (
          <tr>
            <td colSpan={100} className="w-full py-16 text-center">
              <div className="max-w-[95vw]">
                <Typography color="text.disabled">
                  Nothing to display
                </Typography>
              </div>
            </td>
          </tr>
        ) : (
          range(Math.max(rows, minRows)).map((row) => (
            <Box
              as="tr"
              key={row}
              onClick={
                onClickRow || setSelected
                  ? (e) => {
                      shouldIgnoreClick(e) ||
                        (onClickRow
                          ? onClickRow(e, row)
                          : setSelected(selected === row ? -1 : row));
                    }
                  : null
              }
              {...(typeof rowProps === "function" ? rowProps(row) : {})}
            >
              {range(cols).map((j) =>
                callHooks(
                  row >= rows ? null : data,
                  row,
                  j,
                  [],
                  {},
                  renderHooks
                )
              )}
            </Box>
          ))
        )}
      </tbody>
    </table>
  );
  if (scrollable)
    return <div className="overflow-x-auto -mx-3 px-1">{table}</div>;
  else return table;
}

export const TableContext = createContext([-1, noop]);

export const TableHeader = (props) => (
  <Template
    props={props}
    className="flex justify-between mb-4 items-baseline"
  />
);

export const TableButton = ({ onClick, ...props }) => {
  const [selected] = useContext(TableContext);
  return (
    <Template
      props={props}
      as={ThemedButton}
      variant="text"
      color="secondary"
      onClick={(e) => onClick(selected, e)}
    />
  );
};

const shouldIgnoreClick = (e) => {
  let m = e.target;
  while (m && m !== e.currentTarget) {
    if (/^(?:BUTTON|A)$/.test(m.tagName)) {
      return true;
    }
    m = m.parentElement;
  }
  return false;
};

/**
 * Render Hooks
 * @typedef {string|import("react").Component} TableCellValue
 *
 * @typedef {{
 *  data: Array<Array<TableCellValue>|TableCellValue>|TableCellValue,
 *  row: number,
 *  col: number,
 *  classes: Array<string>,
 *  attrs: Record<string, any>
 * }} TableCellInfo
 *
 * @typedef {(input: TableCellInfo & {next: TableRenderHook})=>Partial<TableCellInfo>} TableRenderHook
 */

const toReactComponent = (e) => {
  return isValidElement(e) ? e : String(e ?? "--");
};
/**
 * @param {TableCellInfo}
 * @returns {import("react").Component}
 */
const renderTableCell = ({ data, row, col, classes, attrs }) => {
  return row >= 0 ? (
    <td key={row + ";" + col} className={classes.join(" ")} {...attrs}>
      {toReactComponent(Array.isArray(data?.[row]) ? data[row][col] : data)}
    </td>
  ) : (
    <th key={col} className={classes.join(" ")} {...attrs}>
      {toReactComponent(Array.isArray(data) ? data[col] : data)}
    </th>
  );
};

const callHooks = (
  _data,
  _row,
  _col,
  _classes,
  _attrs,
  [firstHook, ...renderHooks]
) => {
  return (firstHook || renderTableCell)({
    data: _data,
    row: _row,
    col: _col,
    classes: _classes,
    attrs: _attrs,
    next: ({
      data = _data,
      row = _row,
      col = _col,
      classes = _classes,
      attrs = _attrs,
    } = {}) => callHooks(data, row, col, classes, attrs, renderHooks),
  });
};

/**
 * Hook that adds a class to all the table headers
 * @param {string} className
 * @returns {TableRenderHook}
 */

export const addHeaderClass =
  (className) =>
  ({ row, classes, next }) =>
    row < 0 ? next({ classes: classes.concat(className) }) : next();

/**
 * Hook that supplies the label of a table header
 * @param {(col: number)=>TableCellValue} getHeader
 * @returns {TableRenderHook}
 */
export const supplyHeader =
  (getHeader) =>
  ({ row, col, next }) =>
    row < 0 ? next({ data: getHeader(col) }) : next();

/**
 * Hook that adds a class to all columns or some if columns is specified
 * @param {string} className
 * @param {Array<number>} [columns]
 * @returns {TableRenderHook}
 */
export const addClassToColumns =
  (className, columns = null) =>
  ({ row, col, classes, next }) =>
    row >= 0 && (!columns || columns.includes(col))
      ? next({ classes: classes.concat(className) })
      : next();

/**
 * Hook that adds a clickListener to all columns or some if columns is specified
 * @param {Function} onClick
 * @param {Array<number>} [columns]
 * @returns {TableRenderHook}
 */
export const onClickHeader =
  (onClick, columns = null) =>
  ({ row, col, next, attrs }) =>
    row < 0 && (!columns || columns.includes(col))
      ? next({
          attrs: mergeProps(attrs, { onClick: (e) => onClick(e, col) }, [
            "onClick",
          ]),
        })
      : next();
/**
 * Hook that supplies the value of a cell in a table
 * @param {(row:number, col:number, data: TableCellValue|null)=>TableCellValue} getValue
 * @returns {TableRenderHook}
 */
export const supplyValue =
  (getValue) =>
  ({ row, col, data, next }) =>
    row >= 0 ? next({ data: getValue(row, col, data) }) : next();

/**
 * Hook that maps the row number on page to the actual row number in data
 * @param {number} currentPage
 * @param {number} pageSize
 * @returns {TableRenderHook}
 */
export const pageData =
  (currentPage, pageSize) =>
  ({ row, next }) =>
    row >= 0 ? next({ row: row + (currentPage - 1) * pageSize }) : next();

/**
 * Hook that supplies the maximum and minimum width of a table cell
 * @param {number} column
 * @param {string} widthClass
 * @returns {TableRenderHook}
 */
export const clipColumn =
  (column, widthClass = "w-56") =>
  ({ data, col, row, next }) =>
    row >= 0 && column === col
      ? next({
          data: (
            <span
              className={`inline-block align-bottom ${widthClass} whitespace-nowrap overflow-hidden text-ellipsis`}
            >
              {data}
            </span>
          ),
        })
      : next();

/**
 * React Hook for filtering a table by the values on a particular column
 * @template T
 *
 * @param {Array<T>} data
 * @param {(value: T)=>string} select
 * @param {number} column
 * @param {Array<string>} values
 * @param {string} emptyText
 * @returns {[Array<T>, TableRenderHook]}
 */
export const useColumnSelect = (
  data,
  select,
  column,
  values,
  emptyText = "No filter"
) => {
  const [active, setActive] = useState("all");
  select = useRef(select).current;
  const cols = useMemo(
    () => values ?? (data ? data.map(select).sort().filter(uniq) : []),
    [data, select, values]
  );
  const filtered = useMemo(
    () =>
      !data || active === "all"
        ? data
        : data.filter((e) => select(e) === cols[active]),
    [data, select, cols, active]
  );
  return [
    filtered,
    ({ row, col, next }) =>
      row < 0 && col === column
        ? next({
            data: (
              <select
                onChange={(e) => {
                  setActive(e.target.value ? Number(e.target.value) : "all");
                }}
                className="select-1"
              >
                {cols.map((e, i) => (
                  <option key={e} value={i}>
                    {e}
                  </option>
                ))}
                <option value="">{emptyText}</option>
              </select>
            ),
          })
        : next(),
  ];
};
