import isServerSide from "@/utils/is_server_side";

const itemStore = [];
isServerSide || (window.itemStore = itemStore);
/**
 *
 * @param {import("firebase/firestore").DocumentReference} ref
 * @returns {import("./model").Item}
 */
export const getItemFromStore = (ref) => {
  let item;
  return itemStore.some((map) => {
    if (map.has(ref.path)) {
      item = map.get(ref.path);
      return true;
    }
  })
    ? item
    : null;
};

export const mountStore = () => {
  const x = new Map();
  itemStore.push(x);
  return {
    keep(item) {
      x.set(item._ref.path, item);
    },
    unmount: () => {
      const m = itemStore.indexOf(x);
      if (m > -1) itemStore.splice(m, 1);
    },
  };
};
