import { Item, Model, USES_EXACT_IDS, getCollection } from "./lib/model";
import { CountedItem } from "./lib/counted_item";
import UpdateValue from "./lib/update_value";
import notIn from "@/utils/notIn";

class SearchTag extends Item {
  static strictKeys = false;
}
export const SearchTags = new Model("search_tags", SearchTag);

export class IndexEntry extends CountedItem {
  tokens = [];
  getItem() {
    const id = this.id().split("^").pop();
    return this.getModel()?.item?.(id) ?? this;
  }
  getModel() {
    const collection = this.id().split("^").shift();
    return getCollection(collection);
  }
  async onAddItem(txn, newState) {
    await super.onAddItem(txn, newState);
    updateTokens(newState.tokens, this.id(), txn, UpdateValue.arrayUnion);
  }
  async onDeleteItem(txn, prevState) {
    await super.onDeleteItem(txn, prevState);
    updateTokens(prevState.tokens, this.id(), txn, UpdateValue.arrayRemove);
  }
  async onUpdateItem(txn, newState, prevState) {
    await super.onUpdateItem(txn, newState, prevState);
    if (this.didUpdate("tokens")) {
      const added = newState.tokens.filter(notIn(prevState.tokens));
      const removed = prevState.tokens.filter(notIn(newState.tokens));
      updateTokens(removed, this.id(), txn, UpdateValue.arrayRemove);
      updateTokens(added, this.id(), txn, UpdateValue.arrayUnion);
    }
  }
  static {
    this.markTriggersUpdateTxn(["tokens"], true);
  }
}

const INDEX_SIZE = 3;
function updateTokens(tokens, id, txn, method) {
  const m = {};
  tokens.forEach((token) => {
    const index = getIndex(token);
    if (!m[index]) m[index] = {};
    m[index][token.slice(INDEX_SIZE) || "-"] = (
      m[index][token.slice(INDEX_SIZE) || "-"] || []
    ).concat(id);
  });
  for (let index in m) {
    for (let token in m[index]) {
      m[index][token] = method(...m[index][token]);
    }
    SearchTags.item(index, true).set(m[index], txn);
  }
}

export function getIndex(token) {
  token = token.normalize("NFKD").replace(/[\u0300-\u036F]/g, "");
  return token.slice(0, INDEX_SIZE);
}

export const SearchIndex = new Model("search_index", IndexEntry, {
  [USES_EXACT_IDS]: true,
});
