import {
  getDoc,
  where,
  query,
  getDocs,
  onSnapshot,
  orderBy,
  startAfter,
  limit,
  endBefore,
  limitToLast,
  getCountFromServer,
  documentId,
  queryEqual,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import createSubscription from "@/utils/createSubscription";
import useStable from "@/utils/useStable";
import { noop } from "@/utils/none";
import { Item, noFirestore } from "./model";
import { range } from "d3";
import usePager from "@/utils/usePager";
import useLogger from "@/utils/useLogger";
import { InvalidParameters, InvalidState } from "./errors";
import pool from "@/utils/request_pool";

const _getDoc = pool(getDoc, queryEqual);
const _getDocs = pool(getDocs, queryEqual);
export const DEFAULT_ORDERING = "!model-default-ordering";
export const DEFAULT_ORDERING_DESCENDING = "!model-default-descending";
export const SECONDARY_ORDERING = "!model-secondary-ordering";
export const SECONDARY_ORDERING_DESCENDING = "!model-secondary-descending";
/**
 * Firebase has no paging support.
 * The first instinct might be to data the ids in buckets but since sort order,
 * and filtering might change, I instead choose to use something similar to what
 * text editors use to synchronize text on the screen.
 *
 * The bulk of the issues with pagination are basically what to do when the table changes
 * while we are using it. usePagedQuery handles this.
 *
 * @typedef {import("firebase/firestore").QuerySnapshot} QuerySnapshot
 * @typedef {import("firebase/firestore").QueryDocumentSnapshot} QueryDocumentSnapshot
 */

/**
 * Provides anchors for moving to the next page or going to the previous page
 */
class LocalCache {
  //When items which were in the window get removed, assume they were deleted
  //This is the only policy implemented for now.
  static ASSUME_DELETED_POLICY = 2;

  /** @type {Array<QueryDocumentSnapshot>} */
  data = [];
  start = 0;
  end = 0;
  _busy = null;

  _ensureLocked() {
    if (!this._busy)
      throw new InvalidState("Cannot modify cache without acquiring lock");
  }

  /**
   *
   * @param {QuerySnapshot} snapshot
   * @param {number} policy
   * @returns
   */
  onNewData(snapshot, policy = LocalCache.ASSUME_DELETED_POLICY) {
    if (policy !== LocalCache.ASSUME_DELETED_POLICY)
      throw new InvalidParameters(
        "Unknown policy passed to LocalCache.onNewData"
      );
    this._ensureLocked();
    const data = snapshot.docs;
    this.data.splice(
      this.start,
      policy === LocalCache.ASSUME_DELETED_POLICY ? this.end - this.start : 0,
      ...data
    );
    this.end = this.start + data.length;
    this._ensureUnique();
    return this.get();
  }

  _ensureUnique() {
    const data = this.data;
    const mid = data.slice(this.start, this.end).map((e) => e.id);
    let l = 0;
    for (let i = this.start - 1; i >= 0; i--) {
      if (data[i] && mid.includes(data[i].id)) {
        data.splice(i, 1);
        l++;
      }
    }
    this.setPage(this.start - l);
    for (let i = data.length - 1; i >= this.end; i--) {
      if (data[i] && mid.includes(data[i].id)) data.splice(i, 1);
    }
  }
  /**
   * @returns {Array<import("./lib/model").Item>}
   */
  get() {
    return this.data
      .slice(this.start, this.end)
      .filter(Boolean)
      .map((e) => e.data());
  }

  setPage(start, pageSize = this.end - this.start) {
    this._ensureLocked();
    this.start = start;
    this.end = Math.min(this.start + pageSize, this.data.length);
    console.assert(
      this.hasNextAnchor(this.start) || this.hasPrevAnchor(this.end),
      "current page must have an anchor for retrieving data and getting index"
    );
  }
  hasNextAnchor(start) {
    return start === 0 || this.data[start - 1];
  }
  nextAnchor(size) {
    console.assert(this.hasNextAnchor(this.start), "noAnchor");
    return this.start > 0
      ? [startAfter(this.data[this.start - 1]), limit(size)]
      : [limit(size)];
  }
  hasPrevAnchor(end) {
    return this.data[end];
  }
  prevAnchor(size) {
    console.assert(this.hasPrevAnchor(this.end), "noAnchor");
    return this.data[this.end]
      ? [endBefore(this.data[this.end]), limitToLast(size)]
      : null;
  }
  closestAnchor(start) {
    while (!this.hasNextAnchor(start)) start -= 1;
    return start;
  }

  syncStart(start) {
    this._ensureLocked();

    const offset = this.start - start;
    if (offset === 0) return;
    if (offset > 0) {
      this.data.splice(0, offset);
    } else {
      this.data.splice(0, 0, ...range(-offset).map(() => null));
    }
    this.setPage(start);
  }
  async reset() {
    await this.run(() => {
      this.data.length = 0;
      this.setPage(0);
    });
  }
  size() {
    return this.data.length;
  }
  hasData() {
    return this.data.slice(this.start, this.end).some(Boolean);
  }

  async run(fn) {
    while (this._busy) await this._busy;
    let resume;
    this._busy = new Promise((_resume) => {
      resume = () => {
        this._busy = null;
        _resume();
      };
    });
    try {
      return await fn();
    } finally {
      resume();
    }
  }
}

/**
 *
 * @param {QueryCursor} query
 */

const PAGE_DIRECTION_FORWARDS = 1;
const PAGE_DIRECTION_BACKWARDS = -1;
let _id = 1;
/**
 * TODO: caching queries that start and stop frequently by using a snapshot/local cache
 */
export class QueryCursor {
  _pageSize = 100;
  _scrollDirection = PAGE_DIRECTION_FORWARDS;
  _filters = [];
  _ordering = [];
  _onError = console.error;
  _unsubscribe = null;
  _anchorValue = null;
  _query = null;
  _hasLoaded = false;
  /**
   *
   * @param {import("./lib/model").Model} model
   */
  constructor(model) {
    //Used for filtering
    this.model = model;
    this._cache = new LocalCache();
    // A subscription that notifies listeners when this query completes
    [, this._subscribe, this._dispatch] = createSubscription(() => {
      this._start();
      return () => {
        const x = this._unsubscribe;
        this._unsubscribe = null;
        x();
      };
    });
    this.id = _id++;
    this.orderBy();
  }

  // Construct a firebase query from this MultiQuery's state
  // Also, the cache, _filters, _pageSize and _ordering must only be changed using their respective methods.
  get query() {
    return noFirestore
      ? null
      : this._query || (this._query = this._createQuery());
  }

  _createQuery() {
    console.debug("Recreating " + this.model.uniqueName() + " query....");
    this._anchorValue =
      this._scrollDirection === PAGE_DIRECTION_FORWARDS
        ? this._cache.hasNextAnchor(this._cache.start)
        : this._cache.hasPrevAnchor(this._cache.end);
    return query(
      this.model._ref,
      ...this._filters,
      ...this._ordering,
      ...(this._scrollDirection === PAGE_DIRECTION_FORWARDS
        ? this._cache.nextAnchor(this._pageSize)
        : this._cache.prevAnchor(this._pageSize))
    ).withConverter(this.model.converter);
  }

  // A Query can be in one of 4 states: stopped, stopped-busy, running, running-busy
  // A query starts running once it has at least one listener
  _isRunning() {
    return this._unsubscribe !== null;
  }
  // A query gets busy when it is trying to jump to a new page
  _isBusy() {
    return this._cache._busy !== null;
  }

  // Data retrieval methods
  async get() {
    if (noFirestore) return [];

    if (this._isRunning()) {
      return await new Promise((r) => {
        // Get from cache
        const l = this._subscribe((e) => {
          l();
          r(e);
        });
      });
    } else {
      const x = await this._cache.run(async () => {
        this._hasLoaded = true;
        return this._cache.onNewData(await _getDocs(this.query));
      });
      // Restart subscription just in case a listener subscribed while this was running.
      // This could unintentionally resume a paused subscription ie
      // Such as while _bulkLoading but the probability is likely low
      this.restart();
      return x;
    }
  }
  watch(cb, onError) {
    if (noFirestore) return noop;
    if (onError) this._onError = onError;
    return this._subscribe(cb);
  }

  _start() {
    if (this._isRunning()) this._unsubscribe();
    console.debug("Restarting snapshot busy:" + this._isBusy());
    let query;
    this._hasLoaded = false;

    this._unsubscribe = this._isBusy()
      ? noop
      : onSnapshot((query = this.query), {
          next: (snapshot) => {
            this._cache.run(() => {
              if (query === this.query) {
                this._hasLoaded = true;
                this._dispatch(this._cache.onNewData(snapshot));
              }
            });
          },
          error: (error) => {
            this._onError?.(error);
          },
        });
    // Must come after to prevent messing with this.isBusy
    if (this._cache.hasData())
      this._cache.run(() => {
        if (!this._hasLoaded) this._dispatch(this._cache.get());
      });
  }
  restart() {
    this._query = null;
    if (this._isRunning()) this._start();
  }
  /**
   *
   * @param {number} start
   * @returns {AsyncGenerator<Item[], Item[], void>}
   */
  async *iterator(start = this._cache.start) {
    await this.seek(start);
    let results = await this.get();
    while (results.length >= this._pageSize) {
      yield results;
      try {
        await this.advance();
        results = await this.get();
      } catch (e) {
        this._onError?.(e);
        console.error(e);
      }
    }
    yield results;
  }
  async advance() {
    return await this.seek(this._cache.end);
  }

  async seek(index) {
    // Ensure index is valid
    if (typeof index !== "number" || index < 0 || Number.isNaN(index))
      throw new InvalidParameters("Invalid index: " + index + " supplied");
    try {
      if (
        await this._cache.run(async () => {
          const scrollDirection =
            index < this._cache.start &&
            index > this._cache.start - this._pageSize &&
            index !== 0
              ? PAGE_DIRECTION_BACKWARDS
              : PAGE_DIRECTION_FORWARDS;
          const anchor =
            scrollDirection === PAGE_DIRECTION_BACKWARDS
              ? this._cache.hasPrevAnchor(index + this._pageSize)
              : this._cache.hasNextAnchor(index);
          if (anchor) {
            if (
              anchor === this._anchorValue &&
              scrollDirection === this._scrollDirection
            ) {
              console.debug(
                "Ignored the attempt to seek when anchors are unchanged."
              );
              return false;
            }
            this._scrollDirection = scrollDirection;
            this._cache.setPage(index, this._pageSize);
          } else {
            await this._bulkLoadUpTo(index);
          }
          return true;
        })
      ) {
        this.restart();
        return true;
      } else return false;
    } catch (e) {
      this.restart();
      throw e;
    }
  }

  async _bulkLoadUpTo(targetIndex) {
    this._scrollDirection = PAGE_DIRECTION_FORWARDS;
    let closestIndex = this._cache.closestAnchor(targetIndex);
    console.debug("Bulk loading...");
    while (closestIndex < targetIndex) {
      this.restart(); //stops any subscriptions
      let prevPageSize = this._pageSize;
      this._pageSize = Math.min(
        targetIndex - closestIndex,
        this._pageSize * 10
      );
      console.debug("seek from " + closestIndex + " -> +" + this._pageSize);
      this._cache.setPage(closestIndex);
      let query = this.query;
      this._pageSize = prevPageSize;
      this._cache.onNewData(await _getDocs(query));
      // TODO allow cancellation or something
      const m = this._cache.closestAnchor(targetIndex);
      if (closestIndex > m) {
        return console.debug("failed " + m + " vs " + closestIndex);
      }
      closestIndex = m;
    }
    this._cache.setPage(targetIndex);
  }

  // Pager methods
  get page() {
    return Math.floor(this._cache.start / this._pageSize);
  }
  get index() {
    return this._cache.start;
  }
  async getCount(max) {
    return await this._cache.run(async () => {
      return (
        await getCountFromServer(
          query(
            this.model._ref,
            ...this._filters,
            ...this._ordering,
            ...(isNaN(max) ? [] : [max(Number(max) + 1)])
          )
        )
      ).data().count;
    });
  }
  get sentinelValue() {
    return this._cache.data[this._cache.end - 1];
  }
  /**
   * Returns the first document after the last item if any
   */
  sentinel(cb, watch = true) {
    console.debug(`${watch ? "Watching" : "Reading"} for new values`);
    const _query = query(
      this.model._ref,
      ...this._filters,
      ...this._ordering,
      startAfter(this.sentinelValue),
      limit(1)
    );
    if (watch)
      return onSnapshot(_query, {
        next: (snapshot) => {
          cb(snapshot.docs[0]);
        },
        error: this._onError,
      });
    else _getDocs(_query).then((snapshot) => cb(snapshot.docs[0]));
  }
  /**
   * Synchronize the current page. This method also resets backward pagination.
   * usePagedQuery does this automatically.
   */
  async syncIndex() {
    if (this._cache.size() === 0) return 0;
    if (
      this._scrollDirection === PAGE_DIRECTION_FORWARDS &&
      this._cache.start === 0
    )
      return 0;

    this._cache.run(async () => {
      if (!this._cache.data[this._cache.start])
        return console.warn(
          "Cannot get index until documents have been loaded"
        );
      const index = (
        await getCountFromServer(
          query(
            this.model._ref,
            ...this._filters,
            ...this._ordering,
            ...[
              this._cache.data[this._cache.start]
                ? endBefore(this._cache.data[this._cache.start])
                : null,
            ].filter(Boolean)
          )
        )
      ).data().count;
      this._cache.syncStart(index);
    });
  }

  // Constructor methods
  /**
   *
   * @param {string} key
   * @param {import("firebase/firestore").WhereFilterOp} op
   * @param {any} val
   * @returns
   */
  setFilter(key, op, val, ...params) {
    this._filters = [];
    this._filters.push(where(key, op, val));
    if (params.length % 3 !== 0)
      throw new InvalidParameters("Invalid filters supplied");
    while (params.length > 0) {
      this._filters.push(where(...params.splice(0, 3)));
    }
    this._query = null;
    this._cache.reset().then(() => this.restart());
    return this;
  }
  orderBy(key, descending, secondKey, secondDescending) {
    key = key ?? this.model.Meta[DEFAULT_ORDERING];
    descending =
      descending ?? this.model.Meta[DEFAULT_ORDERING_DESCENDING] ?? false;
    secondKey = secondKey ?? this.model.Meta[SECONDARY_ORDERING];
    secondDescending =
      secondDescending ??
      this.model.Meta[SECONDARY_ORDERING_DESCENDING] ??
      false;
    this._ordering = [];
    if (key) {
      this._ordering.push(orderBy(key, descending ? "asc" : "desc"));
    }
    if (secondKey && secondKey !== key)
      this._ordering.push(
        orderBy(secondKey, secondDescending ? "asc" : "desc")
      );
    if (this._ordering.length === 0) {
      this._ordering.push(orderBy(documentId()));
    }
    this._query = null;
    this._cache.reset().then(() => this.restart());
    return this;
  }
  pageSize(size) {
    this._pageSize = size;
    this.restart();
    return this;
  }
}

export class DocumentQueryCursor {
  /**
   *
   * @param {Item} item
   */
  constructor(item) {
    this.item = item;
  }
  async get() {
    if (noFirestore) return;
    return this.item
      .model()
      .converter.fromFirestore(await _getDoc(this.item._ref), {});
  }
  watch(cb, onError = console.error) {
    if (noFirestore) return noop;
    return onSnapshot(this.item._ref, {
      next(snapshot) {
        cb(snapshot.data());
      },
      error(error) {
        onError?.(error);
      },
    });
  }
}

export function usePagedQuery(createQuery, deps = [], { ...opts } = {}) {
  const {
    _query: query,
    _reload,
    data,
    loading,
    ...rest
  } = useQuery(createQuery, deps, opts);
  //Get count of items
  const [count, setCount] = useState(Number.MAX_SAFE_INTEGER);

  // Track current page
  const pager = usePager(
    {
      length: count,
      slice() {
        return data;
      },
    },
    query?._pageSize ?? 1
  );
  const { page: _page, goto } = pager;
  const page = _page - 1;
  const lastCheckCountT = useRef(-1);
  //Synchronize pager state with query state and query state with database state
  const sync = useStable(async () => {
    if (!query) return;
    const now = Date.now();
    // Refreshes happen every 2 seconds to 1 hour depending on how close to the edge we are.
    const frequency =
      2000 * 3 ** Math.min(7.5, Math.max(0, pager.numPages - 1 - page));
    const maxPage = Math.floor((count - 1) / query._pageSize);
    const y = query.index;
    if (lastCheckCountT.current + frequency < now) {
      console.debug(
        "Synchronizing query state " +
          (lastCheckCountT.current < 1
            ? "forcefully"
            : "with after delay " + frequency + "ms")
      );
      const _count = await query.getCount();
      lastCheckCountT.current = now;
      if (_count !== count) setCount(_count);
      await query.syncIndex();
    } else
      console.debug(
        "Deferring sync for " +
          frequency +
          "ms for page " +
          page +
          " of " +
          pager.numPages
      );
    const x = query.index;
    if (x === y) {
      const index = Math.max(0, Math.min(page, maxPage)) * query._pageSize;
      if (await query.seek(index)) _reload();
    } else {
      goto(Math.floor(x / query._pageSize));
    }
  });

  useEffect(() => {
    sync();
  }, [query, page, sync]);

  // useLogger({
  //   count,
  // });
  // useLogger({
  //   page,
  // });
  // useLogger({
  //   pageSize: query?._pageSize ?? 1,
  //   loading,
  // });

  // Update count when on the last page if a new item is added after the last page
  const isOnLastPage =
    query &&
    query.page === Math.floor((count - 1) / query._pageSize) &&
    !loading &&
    query._hasLoaded;
  const sentinelValue = query?.sentinelValue;
  useEffect(() => {
    if (query && isOnLastPage && data?.length === query._pageSize) {
      return query.sentinel((e) => {
        if (e) sync();
      }, opts.watch);
    }
  }, [
    count,
    data?.length,
    isOnLastPage,
    opts.watch,
    query,
    sentinelValue,
    sync,
  ]);

  // Update count when data is incomplete since it means stuff has been deleted
  // TODO: test how this interacts with the null padded data
  useEffect(() => {
    if (
      query &&
      data?.length !== undefined &&
      ((data.length < query._pageSize && !isOnLastPage) || data.length === 0)
    ) {
      lastCheckCountT.current = -1;
      sync();
    }
  }, [data?.length, isOnLastPage, query, sync]);

  return { data, loading, pager, ...rest };
}

export function useQuery(createQuery, deps = [], { watch = false } = {}) {
  const dedupeIndex = useRef(0);
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: true,
    count: 0,
    index: 0,
  });
  const getState = useStable(() => state);

  useEffect(
    () => startQuery(dedupeIndex, getState, setState, watch, createQuery),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [watch, ...deps]
  );
  return state;
}

/**TODO stop: unsubscribing  shared queries to save requests */
export function createSharedQuery(query, { watch = false } = {}) {
  const dedupeIndex = { current: 0 };
  return createSubscription(
    (setState) => {
      let lastState;
      return startQuery(
        dedupeIndex,
        () => lastState,
        (s) => {
          lastState = s;
          setState(s);
        },
        { watch },
        () => query
      );
    },
    {
      data: null,
      error: null,
      loading: true,
    }
  );
}

const startQuery = (dedupeIndex, getState, setState, watch, createQuery) => {
  const p = ++dedupeIndex.current;
  /**@type {QueryCursor} */
  const query =
    /* await. Too many issues, just combine with usePromise instead */ createQuery();
  setState({
    ...getState(),
    loading: true,
    _query: query,
    _reload: () => {
      setState({ ...getState(), loading: true });
      if (!watch) {
        query.get().then(onSuccess, onError);
      }
    },
  });
  if (!query) return;
  const onSuccess = (e) => {
    if (p === dedupeIndex.current)
      setState({ ...getState(), loading: false, data: e, error: null });
    else console.debug("Ignored result because query cahnged");
  };
  const onError = (e) => {
    console.warn({ e, success: false, query });
    if (p === dedupeIndex.current)
      setState({ ...getState(), loading: false, error: e });
    else console.debug("Ignored result because query cahnged");
  };
  if (watch) {
    return query.watch(onSuccess, onError);
  } else {
    query.get().then(onSuccess, onError);
    return; //no callback
  }
};
