import TrashIcon from "@heroicons/react/20/solid/TrashIcon";
import Card1 from "./Card1";
import Table, {
  TableButton,
  TableContext,
  TableHeader,
  addClassToColumns,
  addHeaderClass,
  pageData,
} from "./Table";
import Spacer from "./Spacer";
import Pager from "./Pager";
import usePager from "@/utils/usePager";
import { Button, Typography } from "@mui/material";
import Await from "./Await";
import { Printer } from "iconsax-react";
import { ref } from "firebase/storage";
import { useRef } from "react";
import printElement from "@/utils/printElement";
import { None } from "@/utils/none";

function ThemedTable({
  container: TableWrapper = ThemedBox,
  results,
  headers,
  renderHooks = [],
  selected,
  enablePrint = false,
  pager: _pager,
  tableRef,
  onClickRow,
  rowProps,
  ...props
}) {
  const defaultPager = usePager(results || [], 10);
  /** @type {typeof defaultPager} */
  const pager = _pager ?? defaultPager;
  const { data, pageSize, ...controller } = pager;
  const ref = useRef();
  return (
    <TableWrapper selected={selected} {...props}>
      <Table
        loading={!results}
        data={results}
        scrollable
        tableRef={(el) => {
          ref.current = el;
          if (tableRef) tableRef.current = false;
        }}
        onClickRow={onClickRow}
        cols={headers.length}
        rows={Math.min(pageSize, results?.length)}
        minRows={Math.min(pageSize, results?.length + 2)}
        headers={headers}
        headerClass="text-disabled text-left"
        rowProps={(row) => ({
          ...(rowProps || None),
          sx: {
            backgroundColor: selected === row ? "primary.light" : "white",
            color: selected === row ? "white" : null,
            "& .MuiLink-root": {
              color: selected === row ? "white" : undefined,
            },
            ...(rowProps?.sx ?? None),
          },
          className:
            (row >= data.length
              ? "invisible"
              : "shadow-3 border-solid border-0 " +
                (selected === row
                  ? ""
                  : "border-b hover:bg-hoverPrimary border-b-disabledOnPrimaryDark border-opacity-25")) +
            " ",
        })}
        renderHooks={[
          ...[_pager ? null : pageData(controller.page, pageSize)].filter(
            Boolean
          ),
          addHeaderClass(
            "first:pl-8 pr-4 last:pr-0 font-normal text-gray-400 whitespace-nowrap pb-2"
          ),
          addClassToColumns(
            "text-gray-800 first:pl-8 pr-8 pt-1 pb-2 first:rounded-l last:rounded-r"
          ),
          ...renderHooks,
        ]}
      />

      <div className="flex flex-wrap items-center justify-center mt-12">
        <Spacer />
        <Typography variant="body2" sx={{ mr: 4 }}>
          Total
        </Typography>
        <span className="text-disabled mr-2 my-2">
          <Await value={controller.count} />
        </span>
        <Spacer />
        <div className="print:hidden">
          <Pager controller={controller} />
        </div>
        {enablePrint ? (
          <Button
            sx={{ mt: 4, mb: 2, mx: 2 }}
            onClick={() => ref.current && printElement(ref.current)}
          >
            Print <Printer />{" "}
          </Button>
        ) : null}
      </div>
    </TableWrapper>
  );
}

const ThemedBox = function ({
  title,
  headerButtons,
  children,
  selected,
  setSelected,
  ...props
}) {
  return (
    <TableContext.Provider value={[selected, setSelected]}>
      <Card1 boxClass="px-6 py-5" className="my-2 mx-2" {...props}>
        {title || headerButtons ? (
          <TableHeader>
            <Typography variant="h5">{title}</Typography>
            {headerButtons}
          </TableHeader>
        ) : (
          <div className="mb-2"></div>
        )}
        {children}
      </Card1>
    </TableContext.Provider>
  );
};
export default ThemedTable;
