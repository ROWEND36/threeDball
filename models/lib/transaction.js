import { firestore } from "@/logic/firebase_init";
import { refEqual, runTransaction, writeBatch } from "firebase/firestore";
import { InvalidState } from "./errors";
import notIn from "@/utils/notIn";

const promise = () => {
  let r, j;
  const x = new Promise((_r, _j) => {
    r = _r;
    j = _j;
  });
  return [x, r, j];
};

/**
 * - Implements write/read reordering
 * - Choose between using write batch or transaction based on reads
 * - Read caching
 */
let _id = 0;
let TOKEN = {};
export default class Txn {
  docCache = [];
  cbs = [];
  successCbs = [];
  txnFinished = Promise.resolve(true);

  //Used by transactions
  r = null;
  j = null;
  txn = null;
  txnGotten = null;
  id = "#" + _id++;
  useTxn = false;
  constructor(retry, token) {
    if (token !== TOKEN)
      throw new InvalidState(
        "Txn must be used as Txn.run as it is not tested any other way."
      );
    this.retry = retry;
  }
  async get(ref, ...props) {
    if (!this.txnGotten) {
      let notifyTxnGotten;
      [this.txnGotten, notifyTxnGotten] = promise();
      this.txnFinished = runTransaction(firestore, async (txn) => {
        let x;
        [x, this.r, this.j] = promise();
        if (!this.txn) {
          this.debug("Transaction First attempt");
          this.txn = txn;
          notifyTxnGotten();
        } else {
          this.debug("Transaction Retrying...");
          this.j = null;
          this.txn = txn;
          this.docCache = [];
          this.successCbs = [];
          await this.retry();
        }
        return x;
      });
    }
    if (!this.useTxn) {
      this.debug("Received read, using transaction....");
      this.useTxn = true;
    }
    await this.txnGotten;
    const m = this.docCache.find(({ ref: e }) => refEqual(e, ref));
    if (m) return m.value;
    const x = {
      ref,
      value: this.txn.get(ref, ...props),
    };
    this.docCache.push(x);
    return await x.value;
  }
  ignorePreviousReads() {
    /**
     * Experimental method. Only use case is updates which check for existing documents before creating one in getOrCreate.
     */
    this.debug("Ignoring previous reads....");

    this.useTxn = false;
  }
  set(ref, data, ...props) {
    this.cbs.push(["set", ref, data, ...props]);
  }
  update(ref, data, ...props) {
    this.cbs.push(["update", ref, data, ...props]);
  }
  delete(ref, data, ...props) {
    this.cbs.push(["delete", ref, data, ...props]);
  }
  _call(txn) {
    const cbs = this.cbs;
    this.cbs = [];
    _compress(cbs).forEach(([method, ...args]) => txn[method](...args));
  }
  commit() {
    if (this.useTxn) {
      this.debug("Using transaction");
      this._call(this.txn);
      this.r();
    } else {
      if (this.txn) {
        this.debug("Closing last transaction");
        // Abort the transaction and use a writeBatch instead
        const m = new Error();
        this.txnFinished.catch(
          (e) => e !== m && console.error(this.id, "late error ", e)
        );
        this.j(m);
        this.r = this.j = this.txn = this.txnGotten = null;
      }
      if (this.cbs.length) {
        this.debug("Using batch");
        const txn = writeBatch(firestore);
        this._call(txn);
        this.txnFinished = txn.commit();
      } else {
        this.debug("Nothing to write");
        this.txnFinished = Promise.resolve(true);
      }
    }
  }
  onCommit(cb) {
    this.successCbs.push(cb);
  }
  /**
   * @template T
   * @param {(txn: Txn) => T} cb
   * @returns T
   */
  static async run(cb) {
    let result;
    const x = new Txn(async () => {
      x.debug("Running cb");
      try {
        result = await cb(x);
      } catch (e) {
        x.debug("Ecountered error...");
        if (this.j) {
          x.debug("Forwarding error to transaction");
          // Let this error be thrown inside runTransaction instead so in future, it can possibly retry if necessary
          this.j(e);
        } else throw e;
      }
      x.commit();
    }, TOKEN);
    x.debug("Starting");
    await x.retry();
    x.debug("Cb first run completed. Waiting for commit");
    await x.txnFinished;
    x.debug("Commited. Calling cbs");
    let m = x.successCbs;
    x.successCbs = [];
    for (let cb of m) {
      await cb();
    }
    x.debug("returning", result);
    return result;
  }
  debug(...val) {
    // if (process.env.NODE_ENV !== "production") console.log(this.id, ...val);
  }
}

export const _compress = (cbs) => {
  // Split callbacks by refs
  const map = [];
  const method = 0,
    ref = 1,
    data = 2;
  cbs.forEach((cb) =>
    (
      map.find((x) => refEqual(x.ref, cb[ref])) ||
      map[map.push({ ref: cb[ref], cbs: [] }) - 1]
    ).cbs.push(cb)
  );
  const result = map
    .map((x) =>
      x.cbs.reduce((cbs, next) => {
        let prev = cbs[cbs.length - 1];
        if (prev) {
          // Check if adjacent sets can be merged that is they modify different keys
          if (
            prev[method] === next[method] &&
            (next[method] === "update" || next[method] === "set") &&
            Object.keys(next[data]).every(notIn(Object.keys(prev[data])))
            // TODO handle UpdateValues
          ) {
            prev[data] = Object.assign({}, prev[data], next[data]);
          } else cbs.push(next);
        } else cbs.push(next);
        return cbs;
      }, [])
    )
    .flat();
  return result;
};
