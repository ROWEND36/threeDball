import UpdateValue from "./update_value";
import { Item, noFirestore } from "./model";
import { InvalidState, ItemDoesNotExist } from "./errors";
import deepEqual from "deep-equal";
import { ensureCounter } from "./counted_model";
import hasProp from "@/utils/hasProp";
import Txn from "./transaction";
import { onRefsAddItem, onRefsDeleteItem, onRefsUpdateItem } from "./trackRefs";
import {
  onSearchAddItem,
  onSearchDeleteItem,
  onSearchUpdateItem,
} from "./indexForSearch";
import {
  onFilesAddItem,
  onFilesDeleteItem,
  onFilesUpdateItem,
} from "./trackFiles";

/**
 * A counted item is an item that updates external documents when it changes.
 * It does this using transactions.
 * This is used for keeping counts, sums etc.
 */
const NO_TRANSACTION_NEEDED = 0;
const TRANSACTION_NEEDED_NO_PREV_STATE = 1;
const TRANSACTION_NEEDED = 2;
const propsNeedingUpdateTxn = Symbol("propsToUpdateTxn");

export class CountedItem extends Item {
  #needsTransaction = NO_TRANSACTION_NEEDED;
  #inUpdate = false;
  /**
   * Some keys need update transactions. This array stores the ones that have changed.
   */
  #updatedKeys = [];
  _scheduleUpdateTxn(needsPrevState, prop) {
    if (!this.#updatedKeys.includes(prop)) this.#updatedKeys.push(prop);
    // TODO - ensure all transaction updates are necessary
    this.#needsTransaction = Math.max(
      this.#needsTransaction,
      needsPrevState ? TRANSACTION_NEEDED : TRANSACTION_NEEDED_NO_PREV_STATE
    );
  }

  // eslint-disable-next-line no-unused-vars
  didUpdate(prop) {
    if (this.isLocalOnly()) return true;
    if (this.#needsTransaction === NO_TRANSACTION_NEEDED) return false;
    if (!this.#inUpdate)
      throw new InvalidState(
        "Checking for update keys when not in atomic update"
      );
    return this.#updatedKeys.includes(prop);
  }
  getCounter() {
    return this.model().counter;
  }

  /**
   * @param {(txn: import("./transaction").default, doc: this)=>Promise} cb
   * @returns
   */
  async atomicUpdate(cb, needsPrevState = true, txn, prevState) {
    if (txn) {
      if (
        (needsPrevState ||
          (!this.isLocalOnly() &&
            this.#needsTransaction === TRANSACTION_NEEDED)) &&
        !prevState
      ) {
        prevState = this._useFastUpdate ? undefined : await this.read(txn);
        if (prevState === undefined) throw new ItemDoesNotExist(this);
      }
      return await cb(txn, prevState);
    } else {
      return Txn.run((txn) =>
        this.atomicUpdate(cb, needsPrevState, txn, prevState)
      );
    }
  }
  async _create(txn) {
    //TODO: Needs testing to assert that isLocalOnly assertion is actually true
    await ensureCounter(this.model());
    await this.atomicUpdate(
      async (txn) => {
        await super._create(txn);
        await this.onAddItem(txn, this.data());
      },
      false,
      txn,
      null
    );
  }
  async _update(txn, newState, prevState = null) {
    if (this[propsNeedingUpdateTxn]) {
      newState = { ...newState };
      for (let key of this[propsNeedingUpdateTxn]) {
        if (!this.#updatedKeys.includes(key)) {
          delete newState[key];
        }
      }
    }
    try {
      if (this.#inUpdate) throw new InvalidState("Nested Update!!");
      this.#inUpdate = true;
      const ret = await this.atomicUpdate(
        async (txn, prevState) => {
          await super._update(txn, newState, prevState);
          await this.onUpdateItem(txn, newState, prevState);
        },
        this.#needsTransaction === TRANSACTION_NEEDED,
        txn,
        prevState
      );
      this.#updatedKeys.length = 0;
      this.#needsTransaction = NO_TRANSACTION_NEEDED;
      return ret;
    } finally {
      this.#inUpdate = false;
    }
  }
  async save(txn) {
    await super.save(txn);
    this.#updatedKeys.length = 0;
    this.#needsTransaction = NO_TRANSACTION_NEEDED;
  }
  async delete(txn, prevState) {
    if (noFirestore) throw new InvalidState("No Firestore!!");
    if (this[propsNeedingUpdateTxn]) {
      for (let key of this[propsNeedingUpdateTxn]) {
        if (!this.#updatedKeys.includes(key)) {
          this.#updatedKeys.push(key);
        }
      }
    }

    try {
      if (this.#inUpdate) throw new InvalidState("Nested Update!!");
      this.#inUpdate = true;

      await this.atomicUpdate(
        async (txn, prevState) => {
          await super.delete(txn);
          await this.onDeleteItem(txn, prevState);
        },
        true,
        txn,
        prevState
      );
    } finally {
      this.#inUpdate = false;
    }
  }

  // eslint-disable-next-line no-unused-vars
  async onAddItem(txn, newState) {
    await onRefsAddItem(this, txn, newState);
    await onSearchAddItem(this, txn, newState);
    await onFilesAddItem(this, txn, newState);
    if (this.getCounter())
      this.getCounter().set(
        {
          itemCount: UpdateValue.add(1),
        },
        txn
      );
  }

  // eslint-disable-next-line no-unused-vars
  async onDeleteItem(txn, prevState) {
    await onRefsDeleteItem(this, txn);
    await onSearchDeleteItem(this, txn);
    await onFilesDeleteItem(this, txn, prevState);
    if (this.getCounter())
      this.getCounter().set(
        {
          itemCount: UpdateValue.add(-1),
        },
        txn
      );
  }

  // eslint-disable-next-line no-unused-vars
  async onUpdateItem(txn, newState, prevState) {
    await onRefsUpdateItem(this, txn, newState);
    await onSearchUpdateItem(this, txn, newState);
    await onFilesUpdateItem(this, txn, newState, prevState);
  }

  static markTriggersUpdateTxn(props, needsPrevState = true) {
    props.forEach((e) => {
      const storedValue = Symbol(e);
      const descriptor = {
        enumerable: true,
        get() {
          return this[storedValue];
        },
        set(v) {
          if (
            this._isCreated &&
            (v = this.validate(e, v)) !== undefined &&
            ((this._isLoaded && !deepEqual(v, this[storedValue])) ||
              this._useFastUpdate)
          ) {
            this._scheduleUpdateTxn(needsPrevState, e);
          }
          this[storedValue] = v;
        },
      };
      if (!hasProp(this.prototype, propsNeedingUpdateTxn))
        Object.defineProperty(this.prototype, propsNeedingUpdateTxn, {
          value: this[propsNeedingUpdateTxn] || [],
        });
      this.prototype[propsNeedingUpdateTxn].push(e);
      Object.defineProperty(this.prototype, e, {
        ...descriptor,
        configurable: true,
        set(v) {
          //Make this an own property so it can be picked by Object.keys
          Object.defineProperty(this, e, descriptor);
          descriptor.set.call(this, v);
        },
      });
    });
  }
}
