import { parseQuery } from "@/utils/createQuery";
import hasProp from "@/utils/hasProp";
import uniq from "@/utils/uniq";

/**
 * @typedef {import("./counted_item").CountedItem} CountedItem
 */

const _id = (item) => item.uniqueName().replace(/\//g, "^");
const searchIndexProps = Symbol("searchIndexer");
async function updateInTxn(txn, item, newState) {
  const SearchIndex = (await import("@/models/search_index")).SearchIndex;
  if (item[searchIndexProps]) {
    const { props, indexer } = item[searchIndexProps];
    if (props.some((e) => item.didUpdate(e))) {
      const x = { ...newState };
      await Promise.all(
        props.map(async function (e) {
          if (!hasProp(x, e)) {
            const prevState = await item.read(txn);
            x[e] = prevState[e];
          }
        })
      );
      return SearchIndex.getOrCreate(_id(item), async (index, txn) => {
        console.trace("creating search index");
        return index.set(await indexer(index, x), txn);
      });
    }
  }
}
async function deleteInTxn(txn, item) {
  const SearchIndex = (await import("@/models/search_index")).SearchIndex;
  if (item[searchIndexProps]) return SearchIndex.item(_id(item)).delete(txn);
}

/**
 *
 * @param {String[]} props
 * @param {CountedItem} item
 * @param {CountedItem} state
 * @returns
 */
export function createIndexEntry(props, item, state, prev) {
  return {
    tokens: parseQuery(props.map((e) => String(state[e] ?? "")).join(" "))
      .flat()
      .concat(prev ? prev.tokens : [])
      .filter(uniq),
  };
}

/**
 *
 * @param {Array<String>} props
 * @param {typeof import("../models/lib/counted_item").CountedItem} ItemClass
 */
export const indexForSearch = (
  ItemClass,
  props,
  createIndex = createIndexEntry
) => {
  const prev = ItemClass.prototype[searchIndexProps];
  const indexer = (item, state) =>
    createIndex(props, item, state, prev?.indexer?.(item, state));
  ItemClass.markTriggersUpdateTxn(props, false);
  ItemClass.prototype[searchIndexProps] = {
    props: prev ? prev.props.concat(props) : props,
    indexer,
  };
};

export async function onSearchUpdateItem(item, txn, newState) {
  await updateInTxn(txn, item, newState);
}
export async function onSearchAddItem(item, txn, newState) {
  await updateInTxn(txn, item, newState);
}
export async function onSearchDeleteItem(item, txn) {
  await deleteInTxn(txn, item);
}
