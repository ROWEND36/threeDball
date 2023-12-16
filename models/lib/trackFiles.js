import { storage } from "../../logic/firebase_init";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { daysToMs } from "@/utils/time_utils";
import { FileTracker } from "@/models/file_tracker";

const ONE_WEEK = daysToMs(7);
const _id = (path) => path.replace(/^.*\//, "").replace(/[^A-Za-z0-9]/g, "");

export async function markFileForAutoCleanup(path) {
  await FileTracker.getOrCreate(_id(path), async (item, txn) => {
    item.path = path;
    item.timestamp = Date.now() + ONE_WEEK;
    await item.save(txn);
  });
}
async function deleteInTxn(txn, path) {
  return FileTracker.item(_id(ref(storage, path).fullPath)).set(
    {
      path: path,
      timestamp: 0,
    },
    txn
  );
}
async function keepInTxn(txn, path) {
  return FileTracker.item(_id(ref(storage, path).fullPath)).delete(txn);
}

const fileProps = Symbol("fileProps");
/**
 *
 * @param {Array<String>} props
 * @param {typeof import("./counted_item").CountedItem} ItemClass
 */
export const trackFiles = (ItemClass, props) => {
  ItemClass.markTriggersUpdateTxn(props);
  ItemClass.prototype[fileProps] = []
    .concat(ItemClass.prototype[fileProps])
    .concat(props)
    .filter(Boolean);
};
export async function onFilesUpdateItem(item, txn, newState, prevState) {
  item[fileProps]?.forEach?.((e) => {
    if (item.didUpdate(e, newState, prevState)) {
      if (prevState[e]) deleteInTxn(txn, prevState[e]);
      if (newState[e]) keepInTxn(txn, newState[e]);
    }
  });
}
export async function onFilesAddItem(item, txn, newState) {
  item[fileProps]?.forEach?.((e) => {
    if (newState[e]) keepInTxn(txn, newState[e]);
  });
}
export async function onFilesDeleteItem(item, txn, prevState) {
  item[fileProps]?.forEach?.((e) => {
    if (prevState[e]) deleteInTxn(txn, prevState[e]);
  });
}
