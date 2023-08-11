import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  where,
  query,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { firestore } from "@/logic/firebase_init";
import { useEffect, useRef, useState } from "react";
import createSubscription from "@/utils/createSubscription";
import useStable from "@/utils/useStable";
import { InvalidState, ItemDoesNotExist, checkError } from "./errors";
import { noop } from "@/utils/none";
/**
 * @typedef {[string, import("firebase/firestore").WhereFilterOp, any]} FilterParam
 */
export const noFirestore = firestore === null;
export class Model {
  constructor(_collectionID, ItemClass = Item, Empty = {}) {
    this._ref = noFirestore
      ? { path: _collectionID }
      : collection(firestore, _collectionID);
    this.Item = ItemClass ?? Item;
    this.converter = Model.converter(this);
    this.Empty = Empty;
    global[_collectionID + "Model"] = this;
  }
  static converter(model) {
    return {
      toFirestore: (item) => {
        return item.data();
      },
      /** @param {import("firebase/firestore").QueryDocumentSnapshot} snapshot */
      fromFirestore: (snapshot, options) => {
        const data = snapshot.data(options);
        return new model.Item(snapshot.ref, Object.assign(model.Empty, data));
      },
    };
  }
  request(...params) {
    return new MultiQuery(
      noFirestore
        ? null
        : query(this._ref, ...params).withConverter(this.converter)
    );
  }
  all() {
    return this.request();
  }
  /**
   * @param {...FilterParam} params
   */
  filter(...params) {
    return this.request(...params.map(([key, op, val]) => where(key, op, val)));
  }
  item(id, isCreate) {
    return new this.Item(this.ref(id), this.Empty, isCreate);
  }
  async getOrCreate(id) {
    const m = new this.Item(this.ref(id), this.Empty, true);
    try {
      await m.load();
    } catch (e) {
      checkError(e, ItemDoesNotExist);
    }
    return m;
  }
  create() {
    return new this.Item(this.ref(), this.Empty, true);
  }
  ref(...id) {
    return noFirestore ? { path: "server-side" } : doc(this._ref, ...id);
  }
}

class MultiQuery {
  constructor(query) {
    this.query = query;
  }
  async get() {
    if (noFirestore) return [];
    return toItemArray(await getDocs(this.query));
  }
  watch(cb, onError = console.error) {
    if (noFirestore) return noop;
    return onSnapshot(this.query, {
      next(snapshot) {
        console.log(snapshot);
        cb(toItemArray(snapshot));
      },
      error(error) {
        onError?.(error);
      },
    });
  }
}
class DocumentQuery extends MultiQuery {
  async get() {
    if (noFirestore) return;
    return (await getDoc(this.query)).data();
  }
  watch(cb, onError = console.error) {
    if (noFirestore) return noop;
    return onSnapshot(this.query, {
      next(snapshot) {
        cb(snapshot.data());
      },
      error(error) {
        onError?.(error);
      },
    });
  }
}

export function useQuery(createQuery, deps = [], { watch = false } = {}) {
  const dedupeIndex = useRef(0);
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: true,
  });
  const getState = useStable(() => state);
  useEffect(
    () => sendQuery(dedupeIndex, getState, setState, watch, createQuery),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [watch, ...deps]
  );
  return state;
}

export function createSharedQuery(query, { watch = false }) {
  const dedupeIndex = { current: 0 };
  return createSubscription((setState) => {
    setState({
      data: null,
      error: null,
      loading: true,
    });
    let lastState;
    return sendQuery(
      dedupeIndex,
      () => lastState,
      (s) => {
        lastState = s;
        setState(s);
      },
      watch,
      () => query
    );
  });
}

const sendQuery = (dedupeIndex, getState, setState, watch, createQuery) => {
  const p = ++dedupeIndex.current;
  /**@type {MultiQuery} */
  const query = createQuery();
  setState({ loading: true, ...getState() });
  const onSuccess = (e) => {
    console.log({ e, success: true });
    if (p === dedupeIndex.current)
      setState({ loading: false, data: e, error: null });
  };
  const onError = (e) => {
    console.log({ e, error: true });
    if (p === dedupeIndex.current)
      setState({ loading: false, error: e, ...getState() });
  };
  if (watch) {
    return query.watch(onSuccess, onError);
  } else {
    query.get().then(onSuccess, onError);
    return; //no callback
  }
};

/**
 * @class
 * @property {import("firebase/firestore").DocumentReference} _ref
 */
export class Item {
  constructor(ref, data, isNew) {
    Object.defineProperty(this, "_ref", { value: ref });
    Object.defineProperty(this, "_id", { value: ref.id });
    Object.defineProperty(this, "_isLocalOnly", {
      writable: true,
      value: !!isNew,
    });
    Object.defineProperty(this, "_isValid", {
      writable: true,
      value: !!isNew,
    });
    Object.assign(this, data);
  }
  async save() {
    if (noFirestore) throw InvalidState("No Firestore!!");

    if (this._isLocalOnly) {
      // We add merge:true here to handle Metadata and SchoolData's unique case (non-unique uids).
      // Might refactor out later
      await setDoc(this._ref, this.data(), { merge: true });
      this._isLocalOnly = false;
    } else await updateDoc(this._ref, this.data());
  }
  async load() {
    const data = await this.asQuery().get();
    if (data === undefined) {
      throw new ItemDoesNotExist(this);
    }
    Object.assign(this, data);
    if (this._isLocalOnly) this._isLocalOnly = false;
    this._isValid = true;
    return this;
  }
  async set(data) {
    if (noFirestore) throw InvalidState("No Firestore!!");

    Object.assign(this, data);
    if (this._isLocalOnly) {
      await this.save();
    } else await updateDoc(this._ref, data);
    return this;
  }
  // Deleting a document does not make it local only. Other clients might have copies of it.
  // While they would typically not be able to update it,
  // if restoration was made possible by marking it as local only,
  // each client would be able to restore potentially conflicting versions of the same document.
  async delete() {
    if (noFirestore) throw InvalidState("No Firestore!!");
    await deleteDoc(this._ref);
  }

  data() {
    if (!this._isValid)
      throw new InvalidState("Cannot read document that is not loaded");
    return Object.assign({}, this);
  }
  asQuery() {
    return new DocumentQuery(this._ref);
  }
  isLocalOnly() {
    return this._isLocalOnly;
  }
}

/**
 * @param {QuerySnapshot} ref
 */
const toItemArray = (snapshot) => {
  return snapshot.docs.map((e) => e.data());
};
