import { search } from "@/logic/search";
import { FormField } from "./Form";
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useIterator from "@/utils/useIterator";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  Modal,
  TextField,
  Typography,
} from "@mui/material";
import { _searchValue, _id } from "./SearchInput";
import ModelItemPreview, { MODEL_ITEM_PREVIEW } from "./ModelItemPreview";
import InfiniteScroll from "react-infinite-scroll-component";
import { useDebounce, useIntersection, useUpdate } from "react-use";
import { Item, USES_EXACT_IDS } from "@/models/lib/model";
import { IndexEntry } from "@/models/search_index";
import ModelFormDialog from "./ModelFormDialog";
import createQuery from "@/utils/createQuery";
import Template from "./Template";
import delay from "@/utils/delay";
import { ItemDoesNotExist, checkError } from "@/models/lib/errors";
import useStable from "@/utils/useStable";
import { Add, AddCircle, Additem, BoxAdd, CloseCircle } from "iconsax-react";
import { useOnCreateItem } from "./ModelForm";
import { getDefaultValue } from "../models/lib/model_type_info";
import { noop } from "@/utils/none";
import useLogger from "@/utils/useLogger";
import typeOf from "@/utils/typeof";
import { getItemFromStore } from "@/models/lib/item_store";
import Spacer from "./Spacer";

export const SKIP_PICKER = "!skip-preview";
/**
 * @type {import("react").Context<import("@/utils/useIterator").UseIterator<import("@/models/lib/model").Item>>}
 */
const iteratorContext = createContext();
/**
 *
 * @param {Object} props
 * @param {String} props.prop
 * @param {import("../models/lib/model_type_info").ModelTypeInfo} props.meta
 * @returns
 */
export default function ModelFormRefField(props) {
  return <FormField as={RefField} {...props} />;
}
async function* asyncIteratorOf(func) {
  yield* await func();
}

/**
 * @param {Object} params
 * @param {*} params.inputProps
 * @param {String} params.name
 * @param {String} params.id
 * @param {import("../models/lib/model_type_info").ModelPropInfo} params.meta
 * @param {*} params.value
 * @param {*} params.onChange
 * @param {Boolean} params.onChange
 * @param {Array<any>} params.props
 */
function RefField({
  name,
  id,
  meta,
  value,
  onChange,
  required,
  disabled,
  ...props
}) {
  const allowCreate = !meta.refModel.Meta[USES_EXACT_IDS];
  const skipPicker = !!meta[SKIP_PICKER];
  const newItem = useMemo(
    () => allowCreate && meta.refModel.create(),
    [meta, allowCreate]
  );

  const [newItemModalOpen, setNewItemModalOpen] = useState(skipPicker);

  const pickerQuery = useMemo(
    () =>
      meta.pickRefQuery === true ? meta.refModel.all() : meta.pickRefQuery,
    [meta]
  );

  const setValue = useStable((e) => {
    onChange({ target: { value: _id(e) } });
  });

  const activeItem = useMemo(
    () =>
      value &&
      (newItem && value === newItem.id()
        ? newItem
        : getItemFromStore(meta.refModel.ref(value)) ||
          meta.refModel.item(value)),
    [value, meta, newItem]
  );
  const update = useUpdate();
  const onCreateItem = useOnCreateItem();
  useEffect(() => {
    (async () => {
      if (!activeItem) return;
      try {
        if (activeItem.isLocalOnly() && !getItemFromStore(activeItem._ref)) {
          onCreateItem(activeItem);
        } else {
          await activeItem.load();
          update();
        }
      } catch (e) {
        checkError(e, ItemDoesNotExist);
        setValue(getDefaultValue(meta));
      }
    })();
  }, [activeItem, onCreateItem, setValue, meta, update]);
  const stopRefresh = useRef(false);
  const loaded = (stopRefresh.current =
    !value ||
    (activeItem && activeItem._isLoaded) ||
    (newItemModalOpen && stopRefresh.current));
  useMemo(() => {
    if (skipPicker && activeItem && loaded) {
      newItem.setData(activeItem.data());
    }
  }, [skipPicker, activeItem, newItem, loaded]);
  useLogger({ value, activeItem, loaded });
  return (
    <div className="flex items-end flex-wrap justify-end">
      <input
        name={name}
        value={value}
        onChange={noop}
        id={id}
        type="text"
        required={required}
        form={props?.inputProps?.form}
        style={{ padding: 0, maxWidth: 0, border: "none" }}
      />
      {pickerQuery ? (
        <>
          <PickRef
            {...{
              value,
              disabled,
              setValue,
              activePreview: activeItem,
              query: pickerQuery,
              props,
            }}
          />
          <Spacer />
        </>
      ) : (
        <div className="flex flex-grow h-10 items-center">
          <ModelItemPreview
            item={activeItem}
            {...props}
            sx={{ ...props.sx, minWidth: 0, flexGrow: 1 }}
          />
          {!disabled ? (
            <IconButton onClick={() => setValue("")}>
              <CloseCircle />
            </IconButton>
          ) : null}
        </div>
      )}
      {!disabled && allowCreate ? (
        newItemModalOpen ? (
          loaded ? (
            <ModelFormDialog
              edit={newItem}
              key={loaded}
              model={meta.refModel}
              noSave
              onSubmit={(data) => {
                newItem.setData(data);
                setValue(newItem.id());
              }}
              closeOnSubmit
              isOpen={newItemModalOpen}
              onClose={() => setNewItemModalOpen(false)}
            />
          ) : (
            <CircularProgress />
          )
        ) : (
          <Button
            variant="outlined"
            size="small"
            sx={{ mr: 2 }}
            onClick={() => setNewItemModalOpen(true)}
          >
            New <Add className="ml-1" />
          </Button>
        )
      ) : null}
    </div>
  );
}

/** @param {Object} params
 * @param {String} params.id
 * @param {String} params.name
 * @param {String} params.value
 * @param {import("../models/lib/model_type_info").ModelPropInfo} params.meta
 * @param {*} params.props  */

function PickRef({ value, disabled, setValue, activePreview, query, props }) {
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [serverFilter, setServerFilter] = useState("");
  const [clientFilter, setClientFilter] = useState(() =>
    createQuery(filterText)
  );
  useDebounce(
    () => {
      if (typeof query === "string") setServerFilter(filterText);
    },
    2000,
    [query, filterText]
  );
  useEffect(() => {
    setClientFilter(() => createQuery(filterText));
  }, [filterText]);

  const resultIterator = useMemo(
    () =>
      // testIterator(1000) ||
      typeof query === "string"
        ? search(serverFilter, query.split(" ").filter(Boolean))
        : typeof query === "function"
        ? asyncIteratorOf(query)
        : query
        ? query.iterator(0)
        : {
            next() {
              return { done: true };
            },
          },
    [serverFilter, query]
  );
  const iterator = useIterator(resultIterator);
  const { value: results, loading } = iterator;
  const activeResult = results.find((e) => value === _id(e)) ?? null;
  const filterable = useMemo(() => results.some(_searchValue), [results]);
  return (
    <iteratorContext.Provider value={iterator}>
      <Autocomplete
        disablePortal
        renderOption={(props, option) => (
          <ModelItemPreview
            item={option}
            {...props}
            sx={{ width: "20rem", maxWidth: "100%", minWidth: 0, ...props.sx }}
            key={_id(option)}
          />
        )}
        // {...{ groupBy, getOptionLabel, renderGroup }}
        options={results}
        value={activeResult}
        onChange={(_, e) => setValue(e)}
        getOptionLabel={() => ""}
        selectOnFocus
        handleHomeEndKeys
        clearOnBlur
        blurOnSelect
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        inputValue={filterText}
        onInputChange={(_, value) => setFilterText(value)}
        loading={loading && query && !results?.length}
        filterOptions={(x) =>
          filterable
            ? x
                .map((e) => [clientFilter(_searchValue(e)), e])
                .sort((a, b) => b[0] - a[0])
                .map((e) => e[1])
            : x
        }
        disabled={disabled}
        ListboxComponent={InfiniteList}
        ListboxProps={{ elevation: 5 }}
        loadingText={<CircularProgress sx={{ display: "block", mx: "auto" }} />}
        renderInput={(params) => (
          <Template
            as={TextField}
            props={{
              ...props,
              inputProps: {
                ...params.inputProps,
                ...props.inputProps,
                autoComplete: "new-password",
                // disable autocomplete and autofill
              },
            }}
            sx={{
              ...params.sx,
              "& .MuiInputBase-root": {
                flexWrap: "nowrap",
              },
            }}
            {...params}
            value={filterText}
            InputProps={{
              ...params.InputProps,
              startAdornment: open
                ? null
                : activePreview && (
                    <ModelItemPreview
                      className="model-preview"
                      item={activePreview}
                      sx={{ mr: 4 }}
                    />
                  ),
              endAdornment: (
                <>
                  {loading ? (
                    <CircularProgress color="inherit" size={20} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
    </iteratorContext.Provider>
  );
}

const InfiniteList = forwardRef(function InfiniteList(
  { children, ...props },
  ref
) {
  const ref2 = useRef();
  const isVisible = useIntersection(ref2, {
    root: null,
    rootMargin: "0px",
    threshold: 1,
  })?.isIntersecting;
  const { done, value, loadMore, loading } = useContext(iteratorContext);
  useDebounce(
    () => {
      if (isVisible && !loading) {
        loadMore();
      }
    },
    2000,
    [isVisible, loadMore, loading]
  );
  return (
    <div ref={ref} {...props}>
      {/* TODO: Remove this component since it is not working */}
      <InfiniteScroll
        dataLength={value.length}
        hasMore={!done} // Replace with a condition based on your data source
        loader={<LinearProgress ref={ref2} />}
        endMessage={
          <Typography
            variant="caption"
            color="text.disabled"
            textAlign="center"
            display="block"
            mx="auto"
          >
            ----- End -----
          </Typography>
        }
      >
        <ul>{children}</ul>
      </InfiniteScroll>
    </div>
  );
});
