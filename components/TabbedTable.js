import { useEffect, useRef, useState } from "react";
import ThemedButton from "@/components/ThemedButton";
import Table, {
  TableHeader,
  addClassToColumns,
  addHeaderClass,
  pageData,
} from "@/components/Table";
import usePager from "@/utils/usePager";
import Pager from "@/components/Pager";
import printElement from "@/utils/printElement";
import Printed from "@/components/Printed";
import TabbedBox from "./TabbedBox";

export default function TabbedTable({
  results,
  headers,
  tabHeaders,
  onSelectTab,
  currentTab,
  headerContent,
  printHeader,
  footerContent,
  renderHooks,
  onClickRow,
  showPager = true,
  actions,
}) {
  const PAGE_SIZE = showPager ? 10 : 1000;
  const { data, ...controller } = usePager(results || [], PAGE_SIZE);
  const tableRef = useRef();
  const [selected, setSelected] = useState(-1);
  useEffect(() => setSelected(-1), [controller.page, results]);
  return (
    <TabbedBox
      tabHeaders={tabHeaders}
      onSelectTab={onSelectTab}
      currentTab={currentTab}
    >
      <div className="h-6" />
      <TableHeader>{headerContent}</TableHeader>
      <div ref={tableRef}>
        <Printed className="hidden print:block py-10">{printHeader}</Printed>
        <Table
          loading={!results}
          scrollable
          cols={headers.length}
          rows={Math.min(10, results?.length)}
          headers={headers}
          rowSpacing={1}
          headerClass="text-disabled text-left"
          rowClass={(row) =>
            `${selected === row ? "bg-primaryLight text-white" : "bg-white"} ${
              row >= data.length ? "invisible" : "shadow-3"
            }`
          }
          onClickRow={(e, row) =>
            onClickRow
              ? onClickRow((controller.page - 1) * PAGE_SIZE + row)
              : setSelected(selected === row ? -1 : row)
          }
          renderHooks={[
            pageData(controller.page, PAGE_SIZE),
            addHeaderClass("first:pl-4 pr-8 last:pr-0 font-20t"),
            addClassToColumns(
              "first:pl-4 pr-8 last:pr-2 pt-1 pb-1 first:rounded-l last:rounded-r"
            ),
            ...renderHooks,
          ]}
        />
        {showPager ? (
          <div className="print:hidden flex justify-end mt-28">
            <Pager controller={controller} />
          </div>
        ) : null}
        {footerContent}
      </div>
      <TabActions
        actions={actions}
        selected={(controller.page - 1) * PAGE_SIZE + selected}
        tableRef={tableRef}
      />
    </TabbedBox>
  );
}

export function TabActions({ actions, selected, tableRef }) {
  return actions ? (
    <div className="flex justify-end mt-8">
      {actions.onEdit ? (
        <ThemedButton
          disabled={selected === -1}
          onClick={() => actions.onEdit(selected)}
          bg="bg-primary"
          variant="classic"
          className="mx-2"
        >
          Edit
        </ThemedButton>
      ) : null}
      {actions.onDelete ? (
        <ThemedButton
          disabled={selected === -1}
          onClick={() => actions.onDelete(selected)}
          bg="bg-secondary"
          variant="classic"
          className="mx-2"
        >
          Delete
        </ThemedButton>
      ) : null}
      {actions.print ? (
        <ThemedButton
          onClick={() => printElement(tableRef.current)}
          variant="classic"
          className="mx-2"
        >
          Print
        </ThemedButton>
      ) : null}
      {actions.onClose ? (
        <ThemedButton
          onClick={actions.onClose}
          variant="classic"
          bg="bg-primary"
          className="mx-2"
        >
          Close
        </ThemedButton>
      ) : null}
    </div>
  ) : null;
}
